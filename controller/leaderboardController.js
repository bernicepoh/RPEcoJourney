const db = require('../db');

exports.getLeaderboard = (req, res) => {
    const sql = `
        SELECT userName, totalXP, level, streak, image
        FROM user
        WHERE userType = 'User'
        ORDER BY totalXP DESC
        LIMIT 20
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.log(err);
            return res.send("DB error");
        }

        const titles = ["Eco Novice", "Eco Learner", "Eco Seeker", "Eco Explorer", "Eco Defender", "Eco Guardian", "Eco Warrior", "Eco Champion", "Eco Hero", "Eco Master", "Eco Legend"];
        const badges = ["eco-novice.png", "eco-defender.png", "eco-seeker.png", "eco-explorer.png", "activist.png", "eco-guardian.png", "eco-warrior.png", "eco-champion.png", "eco-hero.png", "eco-master.png", "eco-legend.png"];


        const usersWithBadges = rows.map(user => ({
            ...user,
            levelTitle: titles[Math.min(user.level - 1, 10)],
            levelBadge: badges[Math.min(user.level - 1, 10)]
        }));

        res.render("leaderboard", { users: usersWithBadges });
    });
};
