const db = require('../db');

// =======================
// GET CHECK-IN DASHBOARD
// =======================
exports.getCheckInBoard = (req, res) => {
    const userID = req.session.user.userID;

    const sql = `
        SELECT xp, level, streak, lastCheckinDate 
        FROM user_progress 
        WHERE userID = ?
    `;

    db.query(sql, [userID], (err, rows) => {
        if (err) return res.send("DB error");

        const progress = rows[0];

        // ===============================
        // ASSIGN LEVEL TITLE + BADGE
        // ===============================
        let levelTitle = "";
        let levelBadge = "";

        switch (progress.level) {
            case 1:
                levelTitle = "Eco Novice";
                levelBadge = "eco-novice.png";
                break;

            case 2:
                levelTitle = "Eco Learner";
                levelBadge = "eco-learner.png";
                break;

            case 3:
                levelTitle = "Eco Seeker";
                levelBadge = "eco-seeker.png";
                break;

            case 4:
                levelTitle = "Eco Explorer";
                levelBadge = "eco-explorer.png";
                break;

            case 5:
                levelTitle = "Eco Ranger";
                levelBadge = "eco-ranger.png";
                break;

            case 6:
                levelTitle = "Eco Guardian";
                levelBadge = "eco-guardian.png";
                break;

            case 7:
                levelTitle = "Eco Warrior";
                levelBadge = "eco-warrior.png";
                break;

            case 8:
                levelTitle = "Eco Champion";
                levelBadge = "eco-champion.png";
                break;

            case 9:
                levelTitle = "Eco Hero";
                levelBadge = "eco-hero.png";
                break;

            case 10:
                levelTitle = "Eco Master";
                levelBadge = "eco-master.png";
                break;

            default:
                levelTitle = "Eco Legend"; 
                levelBadge = "eco-legend.png";
        }

        progress.levelTitle = levelTitle;
        progress.levelBadge = levelBadge;

        // XP calculations
        const xpNeeded = 500;
        const xpPercent = Math.min((progress.xp / xpNeeded) * 100, 100);

        // GET TODAY MISSIONS
        const today = new Date().toISOString().split("T")[0];

        const missionSql = `
            SELECT checkinDone, contentRead, quizDone
            FROM daily_missions
            WHERE userID = ? AND missionDate = ?
        `;

        db.query(missionSql, [userID, today], (err2, mission) => {
            const missions = mission[0] || {
                checkinDone: 0,
                contentRead: 0,
                quizDone: 0
            };

            res.render('checkinBoard', {
                progress,
                xpPercent,
                xpNeeded,
                missions,
                user: req.session.user
            });
        });
    });
};


// =======================
// DO CHECK-IN
// =======================
exports.doCheckIn = (req, res) => {
    const userID = req.session.user.userID;
    const today = new Date().toISOString().split("T")[0];

    const checkSql = `
        SELECT * FROM user_checkin WHERE userID = ? AND checkinDate = ?
    `;

    db.query(checkSql, [userID, today], (err, rows) => {
        if (rows.length > 0) {
            req.flash("checkedIn", "You have already checked in today!");
            return res.redirect('/checkin-board?already=true');
        }

        // INSERT new check-in
        const insertSql = `
            INSERT INTO user_checkin (userID, checkinDate)
            VALUES (?, ?)
        `;
        db.query(insertSql, [userID, today]);

        // Get progress
        const getProgress = `
            SELECT * FROM user_progress WHERE userID = ?
        `;

        db.query(getProgress, [userID], (err2, row) => {
            const p = row[0];

            let last = p.lastCheckinDate
                ? new Date(p.lastCheckinDate).toDateString()
                : null;

            let yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday = yesterday.toDateString();

            // STREAK LOGIC
            let streak = 1;
            if (last === yesterday) streak = p.streak + 1;

            // XP CALCULATION
            let baseXP = 3;
            let streakBonus = Math.min(streak, 7);
            let xpGain = baseXP + streakBonus;

            let newXP = p.xp + xpGain;
            let newLevel = p.level;
            const xpNeeded = 500;

            // LEVEL UP
            if (newXP >= xpNeeded) {
                newLevel++;
                newXP -= xpNeeded;
            }

            // UPDATE progress
            const updateSql = `
                UPDATE user_progress
                SET xp=?, level=?, streak=?, lastCheckinDate=?
                WHERE userID=?
            `;
            db.query(updateSql, [newXP, newLevel, streak, today, userID]);

            // UPDATE mission progress
            const updateMission = `
                INSERT INTO daily_missions (userID, missionDate, checkinDone)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE checkinDone=1
            `;
            db.query(updateMission, [userID, today]);

            return res.redirect('/checkin-board');
        });
    });
};






