const db = require('../db'); 

const missionPool = [
    'Complete 1 AI Quiz', 
    'Score 30 XP in a Quiz', 
    'Get 100% Score', 
    'Play a Hard-difficulty Quiz',
    'Like a Sustainability Post', 
    'Comment on any Content', 
    'Share 1 Sustainability Post', 
    'Learn a New Eco Word'
];

exports.getWeeklyMissions = (userId, callback) => {
    const checkSql = `
        SELECT * FROM mission 
        WHERE userID = ? 
        AND completedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;

    db.query(checkSql, [userId], (err, existing) => {
        if (err) {
            console.log("Error checking missions:", err);
            return callback(err, null);
        }

        if (existing.length === 0) {
            const shuffled = missionPool.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 3);

            db.query("INSERT INTO mission (userID, missionType, completedAt, xpEarned) VALUES (?, ?, NOW(), 0)", [userId, selected[0]], (err) => {
                if (err) return callback(err, null);
                
                db.query("INSERT INTO mission (userID, missionType, completedAt, xpEarned) VALUES (?, ?, NOW(), 0)", [userId, selected[1]], (err) => {
                    if (err) return callback(err, null);
                    
                    db.query("INSERT INTO mission (userID, missionType, completedAt, xpEarned) VALUES (?, ?, NOW(), 0)", [userId, selected[2]], (err) => {
                        if (err) return callback(err, null);
                        
                        db.query("SELECT * FROM mission WHERE userID = ? ORDER BY missionID DESC LIMIT 3", [userId], (err, newList) => {
                            if (err) return callback(err, null);
                            return callback(null, newList);
                        });
                    });
                });
            });
        } else {
            return callback(null, existing);
        }
    });
};

exports.completeMission = (userId, missionTitle) => {
    const findSql = `
        SELECT missionID FROM mission 
        WHERE userID = ? 
        AND missionType = ? 
        AND xpEarned = 0 
        AND completedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        LIMIT 1
    `;

    db.query(findSql, [userId, missionTitle], (err, rows) => {
        if (err) {
            console.log("Error finding mission:", err);
        } else if (rows.length > 0) {
            const missionID = rows[0].missionID;
            const rewardXP = 20;

            const updateMissionSql = "UPDATE mission SET xpEarned = ?, completedAt = NOW() WHERE missionID = ?";
            
            db.query(updateMissionSql, [rewardXP, missionID], (err) => {
                if (err) {
                    console.log("Error updating mission status:", err);
                } else {
                    const updateUserSql = "UPDATE user SET totalXP = totalXP + ? WHERE userID = ?";
                    
                    db.query(updateUserSql, [rewardXP, userId], (err) => {
                        if (err) {
                            console.log("Error updating user XP:", err);
                        } else {
                            const logSql = "INSERT INTO xp_log (userID, timestamp, xpEarned, earnedFrom) VALUES (?, NOW(), ?, ?)";
                            
                            db.query(logSql, [userId, rewardXP, "Completed Mission: " + missionTitle], (err) => {
                                if (err) {
                                    console.log("Error logging mission XP:", err);
                                } else {
                                    console.log("Mission '" + missionTitle + "' successfully completed for User " + userId);
                                }
                            });
                        }
                    });
                }
            });
        } else {
            console.log("Mission check: '" + missionTitle + "' not active or already done.");
        }
    });
};

