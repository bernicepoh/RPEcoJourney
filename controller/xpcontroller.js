const db = require('../db');



const getXPHistory = async (req, res) => {
    const user = req.session.user;

    if (!user || !user.userID) {
        console.log("❌ XP History Error: No user session found");
        return res.redirect('/login');
    }

    const userId = user.userID;

    const statsQuery = `
        SELECT 
            (SELECT COUNT(*) FROM quiz WHERE userID = ?) as quizCount,
            (SELECT COUNT(*) FROM mission WHERE userID = ? AND xpEarned > 0) as missionCount,
            (SELECT totalXP FROM user WHERE userID = ?) as currentXP,
            (SELECT streak FROM user WHERE userID = ?) as currentStreak
    `;

    const heatmapQuery = `
        SELECT DATE(timestamp) as logDate, SUM(xpEarned) as totalDayXP 
        FROM xp_log 
        WHERE userID = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY DATE(timestamp)
    `;

    const logQuery = `
        SELECT earnedFrom, xpEarned, DATE_FORMAT(timestamp, '%d %b %Y') as formattedDate 
        FROM xp_log 
        WHERE userID = ? 
        ORDER BY timestamp DESC
    `;

    db.query(statsQuery, [userId, userId, userId, userId], (err, statsResults) => {
        if (err) {
            console.error("❌ DB Error (Stats):", err.message);
            return res.status(500).send("Error loading summary stats");
        }

        db.query(heatmapQuery, [userId], (err, heatmapResults) => {
            if (err) {
                console.error("❌ DB Error (Heatmap):", err.message);
                return res.status(500).send("Error loading activity data");
            }

            db.query(logQuery, [userId], (err, logs) => {
                if (err) {
                    console.error("❌ DB Error (Logs):", err.message);
                    return res.status(500).send("Error loading activity logs");
                }

                const heatmapData = {};
                heatmapResults.forEach(row => {
                    const dateStr = row.logDate.toISOString().split('T')[0];
                    heatmapData[dateStr] = row.totalDayXP;
                });

                res.render('xphistory', { 
                    logs: logs, 
                    stats: statsResults[0],
                    heatmapData: JSON.stringify(heatmapData),
                    user: user 
                });
            });
        });
    });
};

module.exports = { getXPHistory };