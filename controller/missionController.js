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
        WHERE userID = $1 
        AND completedAt >= CURRENT_DATE - INTERVAL '7 days'
    `;

    db.query(checkSql, [userId], (err, existing) => {
        if (err) {
            console.log("Error checking missions:", err);
            return callback(err, null);
        }

        if (existing.rows.length === 0) {  // Changed: rows.length
            // Pick 3 random missions
            const shuffled = missionPool.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 3);

            // Insert the first mission
            db.query("INSERT INTO mission (userID, missionType, completedAt, xpEarned) VALUES ($1, $2, NOW(), 0)", [userId, selected[0]], (err) => {
                if (err) return callback(err, null);
                
                // Insert the second mission
                db.query("INSERT INTO mission (userID, missionType, completedAt, xpEarned) VALUES ($1, $2, NOW(), 0)", [userId, selected[1]], (err) => {
                    if (err) return callback(err, null);
                    
                    // Insert the third mission
                    db.query("INSERT INTO mission (userID, missionType, completedAt, xpEarned) VALUES ($1, $2, NOW(), 0)", [userId, selected[2]], (err) => {
                        if (err) return callback(err, null);
                        
                        // Fetch the 3 newly inserted missions to return to the dashboard
                        db.query("SELECT * FROM mission WHERE userID = $1 ORDER BY missionID DESC LIMIT 3", [userId], (err, newList) => {
                            if (err) return callback(err, null);
                            return callback(null, newList.rows);  // Changed: newList.rows
                        });
                    });
                });
            });
        } else {
            // Already have missions, return them
            return callback(null, existing.rows);  // Changed: existing.rows
        }
    });
};

// ==========================================
// 2. COMPLETE A MISSION (Called by Quiz/Likes/Comments)
// ==========================================
exports.completeMission = (userId, missionTitle) => {
    const findSql = `
        SELECT missionID FROM mission 
        WHERE userID = $1 
        AND missionType = $2 
        AND xpEarned = 0 
        AND completedAt >= CURRENT_DATE - INTERVAL '7 days'
        LIMIT 1
    `;

    db.query(findSql, [userId, missionTitle], (err, rows) => {
        if (err) {
            console.log("Error finding mission:", err);
        } else if (rows.rows.length > 0) {  // Changed: rows.rows.length
            // We found a matching mission that is still 'In Progress'
            const missionID = rows.rows[0].missionID;  // Changed: rows.rows[0]
            const rewardXP = 20;

            const updateMissionSql = "UPDATE mission SET xpEarned = $1, completedAt = NOW() WHERE missionID = $2";
            
            db.query(updateMissionSql, [rewardXP, missionID], (err) => {
                if (err) {
                    console.log("Error updating mission status:", err);
                } else {
                    // Mission table updated, now add XP to user table
                    const updateUserSql = 'UPDATE "user" SET totalXP = totalXP + $1 WHERE userID = $2';
                    
                    db.query(updateUserSql, [rewardXP, userId], (err) => {
                        if (err) {
                            console.log("Error updating user XP:", err);
                        } else {
                            // Finally, log the XP gain
                            const logSql = "INSERT INTO xp_log (userID, timestamp, xpEarned, earnedFrom) VALUES ($1, NOW(), $2, $3)";
                            
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