const db = require('../db');
const missionController = require('./missionController');
const getXPRequirement = (level) => (level + 1) * 500;

// =======================
// GET CHECK-IN DASHBOARD
// =======================
exports.getCheckInBoard = (req, res) => {
    const userID = req.session.user.userID;

    missionController.getWeeklyMissions(userID, (err, userMissions) => {
        if (err) return res.send("DB error");

        const sql = `
            SELECT 
                totalXP AS xp, 
                level, 
                streak, 
                checkInDate AS lastCheckinDate, 
                image AS profilePhoto, 
                userName 
            FROM "user" 
            WHERE userID = $1
        `;

        db.query(sql, [userID], (err, rows) => {
            if (err) return res.send("DB error");
            let progress = rows.rows ? rows.rows[0] : rows[0];

            let xpNeeded = getXPRequirement(progress.level);

            if (progress.xp >= xpNeeded && progress.level < 10) {
                let newXP = progress.xp;
                let newLevel = progress.level;

                while (newXP >= getXPRequirement(newLevel) && newLevel < 10) {
                    newXP -= getXPRequirement(newLevel);
                    newLevel++;
                }

                db.query(
                    `UPDATE "user" SET totalXP = $1, level = $2 WHERE userID = $3`,
                    [newXP, newLevel, userID],
                    () => res.redirect("/checkin-board?levelup=true")
                );
                return;
            }

            const titles = ["Eco Novice", "Eco Learner", "Eco Seeker", "Eco Explorer", "Eco Ranger", "Eco Guardian", "Eco Warrior", "Eco Champion", "Eco Hero", "Eco Master", "Eco Legend"];
            const badges = ["eco-novice.png", "eco-learner.png", "eco-seeker.png", "eco-explorer.png", "eco-ranger.png", "eco-guardian.png", "eco-warrior.png", "eco-champion.png", "eco-hero.png", "eco-master.png", "eco-legend.png"];

            progress.levelTitle = titles[Math.min(progress.level, 10)];
            progress.levelBadge = badges[Math.min(progress.level, 10)];

            const currentXPNeeded = getXPRequirement(progress.level);
            const xpPercent = Math.min((progress.xp / currentXPNeeded) * 100, 100);

            return res.render("checkinBoard", {
                progress,
                xpPercent,
                xpNeeded: currentXPNeeded,
                missions: userMissions,
                user: { ...req.session.user, profilePhoto: progress.profilePhoto },
                streakMissed: req.query.miss === "true",
                leveledUp: req.query.levelup === "true"
            });
        });
    });
};

// =======================
// DO CHECK-IN
// =======================
exports.doCheckIn = (req, res) => {
    const userID = req.session.user.userID;
    const today = new Date().toLocaleDateString('en-CA');

    db.query('BEGIN', (err) => {
        if (err) return res.send("DB error");

        db.query(
            `SELECT totalXP AS xp, level, streak, checkInDate 
             FROM "user" 
             WHERE userID = $1 
             FOR UPDATE`,
            [userID],
            (err, result) => {
                const rows = result.rows;
                if (err || !rows.length) {
                    return db.query('ROLLBACK', () => res.send("Error"));
                }

                const p = rows[0];
                let last = p.checkInDate ? new Date(p.checkInDate).toLocaleDateString('en-CA') : null;

                if (last === today) {
                    return db.query('ROLLBACK', () => res.redirect("/checkin-board?already=true"));
                }

                let finalXP, finalLevel, finalStreak;
                let didLevelUp = false;

                if (!p.checkInDate) {
                    finalXP = p.xp + 3;
                    finalLevel = p.level;
                    finalStreak = 1;
                } else {
                    let yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    yesterday = yesterday.toLocaleDateString('en-CA');

                    finalStreak = (last === yesterday) ? p.streak + 1 : 1;
                    finalXP = p.xp + (3 + Math.min(finalStreak, 7));
                    finalLevel = p.level;
                }

                while (finalXP >= getXPRequirement(finalLevel) && finalLevel < 10) {
                    finalXP -= getXPRequirement(finalLevel);
                    finalLevel++;
                    didLevelUp = true;
                }

                db.query(
                    `UPDATE "user" 
                     SET totalXP = $1, level = $2, streak = $3, checkInDate = $4 
                     WHERE userID = $5`,
                    [finalXP, finalLevel, finalStreak, today, userID],
                    (err) => {
                        if (err) {
                            return db.query('ROLLBACK', () => res.send("DB error"));
                        }
                        db.query('COMMIT', () => {
                            res.redirect(`/checkin-board?miss=${finalStreak === 1 && p.streak > 1}${didLevelUp ? '&levelup=true' : ''}`);
                        });
                    }
                );
            }
        );
    });
};

// =======================
// UPDATE PHOTO
// =======================
exports.updatePhoto = (req, res) => {
    const userID = req.session.user.userID;
    if (!req.file) return res.redirect("/profile?error=no-file");

    const newPhotoPath = "/uploads/" + req.file.filename;

    db.query(
        `UPDATE "user" SET image = $1 WHERE userID = $2`,
        [newPhotoPath, userID],
        (err) => {
            if (err) return res.redirect("/profile?error=db");
            req.session.user.image = newPhotoPath;
            return res.redirect("/profile?success=updated");
        }
    );
};