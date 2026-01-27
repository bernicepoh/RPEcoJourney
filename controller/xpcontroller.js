const db = require('../db');

/**
 * GET /xp-history
 * Logic:
 * 1. Validates user session.
 * 2. Fetches lifetime summary stats (Total XP, Quizzes, Missions, Streak).
 * 3. Fetches the last 90 days of activity for the heatmap and 3-month filter.
 * 4. Fetches the detailed activity log for the list view.
 */
const getXPHistory = async (req, res) => {
    // 1. Get the User ID from the session
    const user = req.session.user;

    if (!user || !user.userID) {
        console.log("❌ XP History Error: No user session found");
        return res.redirect('/login');
    }

    const userId = user.userID;

    // 2. QUERY: Lifetime Summary Stats
    // Uses subqueries to get permanent totals from non-expiring tables
    const statsQuery = `
        SELECT 
            (SELECT COUNT(*) FROM quiz WHERE userID = $1) as quizCount,
            (SELECT COUNT(*) FROM mission WHERE userID = $2 AND xpEarned > 0) as missionCount,
            (SELECT totalXP FROM "user" WHERE userID = $3) as currentXP,
            (SELECT streak FROM "user" WHERE userID = $4) as currentStreak
    `;

    // 3. QUERY: Heatmap & Filter Data (Covers the last 3 months)
    const heatmapQuery = `
        SELECT DATE(timestamp) as logDate, SUM(xpEarned) as totalDayXP 
        FROM xp_log 
        WHERE userID = $1 AND timestamp >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY DATE(timestamp)
    `;

    // 4. QUERY: Detailed History Logs
    const logQuery = `
        SELECT earnedFrom, xpEarned, TO_CHAR(timestamp, 'DD Mon YYYY') as formattedDate 
        FROM xp_log 
        WHERE userID = $1 
        ORDER BY timestamp DESC
    `;

    // Execute database queries in sequence
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

                // Process heatmap results into a JSON object: { "YYYY-MM-DD": XP_SUM }
                const heatmapData = {};
                heatmapResults.rows.forEach(row => {  // Changed: results.rows
                    // Normalize date to YYYY-MM-DD format for frontend JS matching
                    const dateStr = row.logDate.toISOString().split('T')[0];
                    heatmapData[dateStr] = row.totalDayXP;
                });

                // 5. Final Render: Pass data to EJS
                res.render('xphistory', { 
                    logs: logs.rows,  // Changed: logs.rows
                    stats: statsResults.rows[0],  // Changed: statsResults.rows[0]
                    heatmapData: JSON.stringify(heatmapData),
                    user: user 
                });
            });
        });
    });
};

module.exports = { getXPHistory };