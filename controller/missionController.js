const db = require('../db'); 

// The Pool of possible missions
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

// ==========================================
// 1. ASSIGN RANDOM MISSIONS (Called by Dashboard)
// ==========================================
exports.getWeeklyMissions = (userId, callback) => {
    // Check if user has missions from the last 7 days
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
            // Pick 3 random missions
            const shuffled = missionPool.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 3);

            // Insert the first mission
            db.query("INSERT INTO mission (userID, missionType, completedAt, xpEarned) VALUES (?, ?, NOW(), 0)", [userId, selected[0]], (err) => {
                if (err) return callback(err, null);
                
                // Insert the second mission
                db.query("INSERT INTO mission (userID, missionType, completedAt, xpEarned) VALUES (?, ?, NOW(), 0)", [userId, selected[1]], (err) => {
                    if (err) return callback(err, null);
                    
                    // Insert the third mission
                    db.query("INSERT INTO mission (userID, missionType, completedAt, xpEarned) VALUES (?, ?, NOW(), 0)", [userId, selected[2]], (err) => {
                        if (err) return callback(err, null);
                        
                        // Fetch the 3 newly inserted missions to return to the dashboard
                        db.query("SELECT * FROM mission WHERE userID = ? ORDER BY missionID DESC LIMIT 3", [userId], (err, newList) => {
                            if (err) return callback(err, null);
                            return callback(null, newList);
                        });
                    });
                });
            });
        } else {
            // Already have missions, return them
            return callback(null, existing);
        }
    });
};

// ==========================================
// 2. COMPLETE A MISSION (Called by Quiz/Likes/Comments)
// ==========================================
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
            // We found a matching mission that is still 'In Progress'
            const missionID = rows[0].missionID;
            const rewardXP = 20;

            const updateMissionSql = "UPDATE mission SET xpEarned = ?, completedAt = NOW() WHERE missionID = ?";
            
            db.query(updateMissionSql, [rewardXP, missionID], (err) => {
                if (err) {
                    console.log("Error updating mission status:", err);
                } else {
                    // Mission table updated, now add XP to user table
                    const updateUserSql = "UPDATE user SET totalXP = totalXP + ? WHERE userID = ?";
                    
                    db.query(updateUserSql, [rewardXP, userId], (err) => {
                        if (err) {
                            console.log("Error updating user XP:", err);
                        } else {
                            // Finally, log the XP gain
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
            // No matching mission found or already completed
            console.log("Mission check: '" + missionTitle + "' not active or already done.");
        }
    });
};