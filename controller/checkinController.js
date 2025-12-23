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

        const sql = `SELECT totalXP AS xp, level, streak, checkInDate AS lastCheckinDate, image AS profilePhoto, userName FROM user WHERE userID = ?`;

        db.query(sql, [userID], (err, rows) => {
            if (err) return res.send("DB error");
            let progress = rows[0];

            // --- DYNAMIC SAFETY CHECK ---
            let xpNeeded = getXPRequirement(progress.level);

            if (progress.xp >= xpNeeded && progress.level < 10) {
                let newXP = progress.xp;
                let newLevel = progress.level;

                while (newXP >= getXPRequirement(newLevel) && newLevel < 10) {
                    newXP -= getXPRequirement(newLevel);
                    newLevel++;
                }

                db.query("UPDATE user SET totalXP = ?, level = ? WHERE userID = ?", [newXP, newLevel, userID], () => {
                    return res.redirect("/checkin-board?levelup=true");
                });
                return;
            }
            // -----------------------------

            const titles = ["Eco Novice", "Eco Learner", "Eco Seeker", "Eco Explorer", "Eco Ranger", "Eco Guardian", "Eco Warrior", "Eco Champion", "Eco Hero", "Eco Master", "Eco Legend"];
            const badges = ["eco-novice.png", "eco-learner.png", "eco-seeker.png", "eco-explorer.png", "eco-ranger.png", "eco-guardian.png", "eco-warrior.png", "eco-champion.png", "eco-hero.png", "eco-master.png", "eco-legend.png"];

            progress.levelTitle = titles[Math.min(progress.level, 10)];
            progress.levelBadge = badges[Math.min(progress.level, 10)];

            // Pass the dynamic xpNeeded to the frontend
            const currentXPNeeded = getXPRequirement(progress.level);
            const xpPercent = Math.min((progress.xp / currentXPNeeded) * 100, 100);

            return res.render("checkinBoard", {
                progress,
                xpPercent,
                xpNeeded: currentXPNeeded, // Send the dynamic value!
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

    db.beginTransaction((err) => {
        if (err) return res.send("DB error");

        db.query(`SELECT totalXP AS xp, level, streak, checkInDate FROM user WHERE userID = ? FOR UPDATE`, [userID], (err, rows) => {
            if (err || !rows.length) return db.rollback(() => res.send("Error"));

            const p = rows[0];
            let last = p.checkInDate ? new Date(p.checkInDate).toLocaleDateString('en-CA') : null;

            if (last === today) return db.rollback(() => res.redirect("/checkin-board?already=true"));

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

            // DYNAMIC LEVEL UP CHECK
            while (finalXP >= getXPRequirement(finalLevel) && finalLevel < 10) {
                finalXP -= getXPRequirement(finalLevel);
                finalLevel++;
                didLevelUp = true; 
            }

            db.query(`UPDATE user SET totalXP=?, level=?, streak=?, checkInDate=? WHERE userID=?`, [finalXP, finalLevel, finalStreak, today, userID], (err) => {
                if (err) return db.rollback(() => res.send("DB error"));
                db.commit(() => {
                    res.redirect(`/checkin-board?miss=${finalStreak === 1 && p.streak > 1}${didLevelUp ? '&levelup=true' : ''}`);
                });
            });
        });
    });
};

// =======================
// UPDATE PHOTO
// =======================
exports.updatePhoto = (req, res) => {
    const userID = req.session.user.userID;
    if (!req.file) return res.redirect("/profile?error=no-file");

    const newPhotoPath = "/uploads/" + req.file.filename;
    db.query("UPDATE user SET image = ? WHERE userID = ?", [newPhotoPath, userID], (err) => {
        if (err) return res.redirect("/profile?error=db");
        req.session.user.image = newPhotoPath;
        return res.redirect("/profile?success=updated");
    });
};















