const db = require('../db');

exports.getLeaderboard = (req, res) => {
    const sql = `
        SELECT userName, totalXP, level, streak, image
        FROM user
        ORDER BY totalXP DESC
        LIMIT 20
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.log(err);
            return res.send("DB error");
        }

        res.render("leaderboard", { users: rows });
    });
};
