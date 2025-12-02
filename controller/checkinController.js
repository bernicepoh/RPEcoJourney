const db = require('../db');

// =======================
// GET CHECK-IN DASHBOARD
// =======================
exports.getCheckInBoard = (req, res) => {
    const userID = req.session.user.userID;

    const sql = `
        SELECT totalXP AS xp,
               level,
               streak,
               checkInDate AS lastCheckinDate,
               image AS profilePhoto,
               userName
        FROM user
        WHERE userID = ?
    `;

    db.query(sql, [userID], (err, rows) => {
        if (err) return res.send("DB error");

        const progress = rows[0];

        // Assign title + badge
        const titles = [
            "Eco Novice", "Eco Learner", "Eco Seeker", "Eco Explorer",
            "Eco Ranger", "Eco Guardian", "Eco Warrior", "Eco Champion",
            "Eco Hero", "Eco Master", "Eco Legend"
        ];

        const badges = [
            "eco-novice.png", "eco-learner.png", "eco-seeker.png", "eco-explorer.png",
            "eco-ranger.png", "eco-guardian.png", "eco-warrior.png", "eco-champion.png",
            "eco-hero.png", "eco-master.png", "eco-legend.png"
        ];

        let lvl = progress.level;
        if (lvl < 0) lvl = 0;
        if (lvl > 10) lvl = 10;

        progress.levelTitle = titles[lvl];
        progress.levelBadge = badges[lvl];

        // XP bar
        const xpNeeded = 500;
        const xpPercent = Math.min((progress.xp / xpNeeded) * 100, 100);

        return res.render("checkinBoard", {
            progress,
            xpPercent,
            xpNeeded,
            missions: { checkinDone: 0, contentRead: 0, quizDone: 0 },
            user: {
                ...req.session.user,
                profilePhoto: progress.profilePhoto
            }, 
            streakMissed: req.query.miss === "true"
        });
    });
};

// =======================
// DO CHECK-IN (NO extra table)
// =======================
exports.doCheckIn = (req, res) => {
    // Guard: ensure user session exists to avoid TypeError when unauthenticated
    if (!req.session || !req.session.user || !req.session.user.userID) {
        return res.redirect('/');
    }

    const userID = req.session.user.userID;
    // Use local date (server timezone) for comparisons to avoid UTC offset issues
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

    // Start a transaction and lock the user row to prevent concurrent check-ins
    db.beginTransaction((err) => {
        if (err) return res.send("DB error");

        const sql = `
            SELECT totalXP AS xp, level, streak, checkInDate
            FROM user
            WHERE userID = ?
            FOR UPDATE
        `;

        db.query(sql, [userID], (err, rows) => {
            if (err) return db.rollback(() => res.send("DB error"));
            if (!rows || rows.length === 0) return db.rollback(() => res.send("User not found"));

            const p = rows[0];

            // Convert checkInDate to YYYY-MM-DD using local timezone
            let last = null;
            if (p.checkInDate) {
                last = new Date(p.checkInDate).toLocaleDateString('en-CA');
            }

            // ALREADY CHECKED IN TODAY -> rollback and redirect
            if (last === today) {
                return db.rollback(() => res.redirect("/checkin-board?already=true"));
            }

            // FIRST EVER CHECK-IN
            if (!p.checkInDate) {
                const initialXP = p.xp + 3;
                const initialLevel = p.level;
                const initialStreak = 1;

                const update = `
                    UPDATE user
                    SET totalXP=?, level=?, streak=?, checkInDate=?
                    WHERE userID=?
                `;

                db.query(update, [initialXP, initialLevel, initialStreak, today, userID], (err) => {
                    if (err) return db.rollback(() => res.send("DB error"));
                    db.commit((err) => {
                        if (err) return db.rollback(() => res.send("DB error"));
                        return res.redirect("/checkin-board");
                    });
                });

                return;
            }

            // NORMAL STREAK LOGIC
            let yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday = yesterday.toLocaleDateString('en-CA');

            let newStreak = (last === yesterday) ? p.streak + 1 : 1;

            //streak broken
            let streakBroken= false;
            if (newStreak === 1 && p.streak > 1) {
                streakBroken = true;
            }

            // XP logic
            const baseXP = 3;
            const streakBonus = Math.min(newStreak, 7);
            const xpGain = baseXP + streakBonus;

            let newXP = p.xp + xpGain;
            let newLevel = p.level;
            const xpNeeded = 500;

            if (newXP >= xpNeeded) {
                newLevel++;
                newXP -= xpNeeded;
            }

            const update2 = `
                UPDATE user
                SET totalXP=?, level=?, streak=?, checkInDate=?
                WHERE userID=?
            `;

            db.query(update2, [newXP, newLevel, newStreak, today, userID], (err) => {
                if (err) return db.rollback(() => res.send("DB error"));
                db.commit((err) => {
                    if (err) return db.rollback(() => res.send("DB error"));
                    return res.redirect(`/checkin-board?miss=${streakBroken}`);
                });
            });

        });
    });
};

exports.updatePhoto = (req, res) => {
    const userID = req.session.user.userID;

    if (!req.file) {
        return res.redirect("/profile?error=no-file");
    }

    const newPhotoPath = "/uploads/" + req.file.filename;

    const sql = "UPDATE user SET image = ? WHERE userID = ?";
    db.query(sql, [newPhotoPath, userID], (err) => {
        if (err) {
            console.log(err);
            return res.redirect("/profile?error=db");
        }

        // Update session so dashboard changes instantly
        req.session.user.image = newPhotoPath;

        return res.redirect("/profile?success=updated");
    });
};















