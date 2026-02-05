const db = require('../db');
const nodemailer = require('nodemailer');
const { translateText, translateMultiple } = require('../middleware/translator');
const missionController = require("./missionController");
const { isUnsafeComment } = require("../hfModeration");
const { cloudinary } = require("../cloudinary");

exports.getContentByContentType = async (req, res) => {
    const contentTypeID = req.params.id;
    const userID = req.session.user ? req.session.user.userID : 0; 
    const currentLang = req.session.language || req.cookies.language || 'en';
    
    console.log('🌐 Current Language:', currentLang);
    console.log('📝 Session Language:', req.session.language);
    console.log('🍪 Cookie Language:', req.cookies.language);

    const sql = `SELECT 
                    c.contentID, 
                    c.contentTitle, 
                    c.contentDescription, 
                    c.contentFile,
                    cat.contentTypeName,
                    cat.contentTypeDescription,
                    cat.contentTypeImage,

                    /* Total like count */
                    (SELECT COUNT(*) 
                    FROM engagement e 
                    WHERE e.contentID = c.contentID 
                    AND e.likes = 1) AS likeCount,

                    /* Whether THIS user liked */
                    (SELECT COUNT(*) 
                    FROM engagement e 
                    WHERE e.contentID = c.contentID 
                    AND e.userID = ? 
                    AND e.likes = 1) AS userLiked,

                    /* Total comment count */
                    (SELECT COUNT(*) 
                    FROM engagement e
                    WHERE e.contentID = c.contentID 
                    AND e.comments IS NOT NULL 
                    AND e.comments != '') AS commentCount,

                    /* Total share count */
                    (SELECT SUM(share)
                    FROM engagement e
                    WHERE e.contentID = c.contentID) AS totalShares

                FROM content c
                JOIN content_type cat
                ON c.contentTypeID = cat.contentTypeID
                LEFT JOIN content_request cr
                ON c.contentID = cr.contentID
                WHERE cat.contentTypeID = ?
                AND (cr.contentID IS NULL OR cr.status = 'approved')
            `;

    db.query(sql, [userID, contentTypeID], async (error, results) => {
        if (error) {
            console.log("🔥 SQL ERROR:", error);
            return res.status(500).send('Error retrieving content');
        }
        if (results.length > 0) {
            if (currentLang !== 'en') {
                console.log('🔄 Translating content to:', currentLang);
                for (let item of results) {
                    console.log('📖 Original contentTypeDescription:', item.contentTypeDescription);
                    item.contentTitle = await translateText(item.contentTitle, currentLang);
                    item.contentDescription = await translateText(item.contentDescription, currentLang);
                    item.contentTypeName = await translateText(item.contentTypeName, currentLang);
                    item.contentTypeDescription = await translateText(item.contentTypeDescription, currentLang);
                    console.log('✅ Translated contentTypeDescription:', item.contentTypeDescription);
                }
            }

            const contentTypeInfo = {
                contentTypeName: results[0].contentTypeName,
                contentTypeDescription: results[0].contentTypeDescription,
                contentTypeImage: results[0].contentTypeImage
            };
            res.render('viewContentByContentType', {
                contentType: contentTypeInfo,
                contentList: results,
                user: req.session.user || null
            });
        } else {
            const catSql = 'SELECT * FROM content_type WHERE contentTypeID = ?';
            db.query(catSql, [contentTypeID], async (catError, catRows) => {
                if (catError || catRows.length === 0) {
                    return res.status(404).send('content type not found');
                }

                let contentTypeName = catRows[0].contentTypeName;
                let contentTypeDescription = catRows[0].contentTypeDescription;

                if (currentLang !== 'en') {
                    contentTypeName = await translateText(contentTypeName, currentLang);
                    contentTypeDescription = await translateText(contentTypeDescription, currentLang);
                }

                const contentTypeInfo = {
                    contentTypeName: catRows[0].contentTypeName,
                    contentTypeDescription: catRows[0].contentTypeDescription,
                    contentTypeImage: catRows[0].contentTypeImage
                };  
                res.render('viewContentByContentType', {
                    contentType: contentTypeInfo,
                    contentList: [],
                    user: req.session.user || null
                });
            });
        }
    });
};

exports.toggleLike = (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, notLoggedIn: true });
    }

    const userID = req.session.user.userID;
    const contentID = req.params.contentID;

    console.log("🔥 Toggle like for:", { userID, contentID });

    const checkSql = `
        SELECT likes FROM engagement 
        WHERE userID = ? AND contentID = ?
    `;

    db.query(checkSql, [userID, contentID], (err, rows) => {
        console.log("📌 SQL rows found:", rows);
        console.log("📌 SQL error:", err);

        if (err) {
            console.error("❌ Error checking like:", err);
            return res.status(500).json({ success: false });
        }

        if (rows.length > 0) {
            const newLikeValue = rows[0].likes === 1 ? 0 : 1;

            console.log("🔄 Updating like to:", newLikeValue);

            const updateSql = `
                UPDATE engagement 
                SET likes = ?
                WHERE userID = ? AND contentID = ?
            `;

            db.query(updateSql, [newLikeValue, userID, contentID], (updateErr) => {
                console.log("❌ Update error:", updateErr);

                if (updateErr) return res.status(500).json({ success: false });

                // Check if mission will be completed
                let missionCompleted = false;
                if (newLikeValue === 1) {
                    // Check if mission exists and is not completed
                    const checkMissionSql = `
                        SELECT missionID FROM mission 
                        WHERE userID = ? 
                        AND missionType = 'Like a Sustainability Post' 
                        AND xpEarned = 0 
                        AND completedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                        LIMIT 1
                    `;
                    
                    db.query(checkMissionSql, [userID], (mErr, mRows) => {
                        if (!mErr && mRows.length > 0) {
                            missionCompleted = true;
                        }
                        
                        // Trigger mission completion
                        missionController.completeMission(userID, 'Like a Sustainability Post');
                        
                        const countSql = `
                            SELECT COUNT(*) AS likeCount
                            FROM engagement 
                            WHERE contentID = ? AND likes = 1
                        `;

                        db.query(countSql, [contentID], (countErr, countRows) => {
                            console.log("❌ Count error:", countErr);
                            console.log("📌 Count rows:", countRows);

                            if (countErr) return res.status(500).json({ success: false });

                            return res.json({
                                success: true,
                                liked: newLikeValue === 1,
                                likeCount: countRows[0].likeCount,
                                missionCompleted: missionCompleted
                            });
                        });
                    });
                } else {
                    const countSql = `
                        SELECT COUNT(*) AS likeCount
                        FROM engagement 
                        WHERE contentID = ? AND likes = 1
                    `;

                    db.query(countSql, [contentID], (countErr, countRows) => {
                        console.log("❌ Count error:", countErr);
                        console.log("📌 Count rows:", countRows);

                        if (countErr) return res.status(500).json({ success: false });

                        return res.json({
                            success: true,
                            liked: newLikeValue === 1,
                            likeCount: countRows[0].likeCount,
                            missionCompleted: false
                        });
                    });
                }
            });

        } else {
            console.log("🆕 No existing row found → creating new one");

            const insertSql = `
                INSERT INTO engagement (userID, contentID, likes)
                VALUES (?, ?, 1)
            `;

            db.query(insertSql, [userID, contentID], (insErr) => {
                console.log("❌ Insert error:", insErr);

                if (insErr) return res.status(500).json({ success: false });

                // Check if mission will be completed
                const checkMissionSql = `
                    SELECT missionID FROM mission 
                    WHERE userID = ? 
                    AND missionType = 'Like a Sustainability Post' 
                    AND xpEarned = 0 
                    AND completedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    LIMIT 1
                `;
                
                db.query(checkMissionSql, [userID], (mErr, mRows) => {
                    const missionCompleted = !mErr && mRows.length > 0;
                    
                    // Trigger mission completion
                    missionController.completeMission(userID, 'Like a Sustainability Post');

                    const countSql = `
                        SELECT COUNT(*) AS likeCount
                        FROM engagement 
                        WHERE contentID = ? AND likes = 1
                    `;

                    db.query(countSql, [contentID], (countErr, countRows) => {
                        console.log("❌ Count error:", countErr);
                        console.log("📌 Count rows:", countRows);

                        if (countErr) return res.status(500).json({ success: false });

                        return res.json({
                            success: true,
                            liked: true,
                            likeCount: countRows[0].likeCount,
                            missionCompleted: missionCompleted
                        });
                    });
                });
            });
        }
    });
};



exports.postComment = async (req, res) => {
    const contentID = req.params.id;
    const userID = req.session.user.userID;
    const commentText = req.body.commentText;

    console.log('📝 Post Comment Request:', { contentID, userID, commentText });

    const profanityRegex = /\b(f+[\W_]*u+[\W_]*c+[\W_]*k+|s+[\W_]*h+[\W_]*i+[\W_]*t+|b+[\W_]*i+[\W_]*t+[\W_]*c+[\W_]*h+|a+[\W_]*s+[\W_]*s+[\W_]*h+[\W_]*o+[\W_]*l+e+)\b/gi;

    if (profanityRegex.test(commentText)) {
        console.log('🚫 Comment failed profanity check');
        return res.redirect(`/content/${contentID}?error=inappropriate`);
    }

    try {
        console.log('🤖 Starting AI moderation...');
        const flagged = await isUnsafeComment(commentText);
        console.log('✅ AI moderation result:', flagged);

        if (flagged) {
            console.log('🚫 Comment flagged as inappropriate');
            return res.redirect(`/content/${contentID}?error=inappropriate`);
        }

        console.log('💾 Inserting comment to database...');
        const sql = `
            INSERT INTO engagement (userID, contentID, comments, share) 
            VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [userID, contentID, commentText, 0], (err) => {
            if (err) {
                console.error('❌ Database insertion error:', err);
                console.error('❌ Error code:', err.code);
                console.error('❌ Error message:', err.message);
                console.error('❌ Error SQL:', err.sql);
                return res.status(500).send("Failed to post comment");
            }
            console.log('✅ Comment posted successfully');
            
            // Check if mission will be completed
            const checkMissionSql = `
                SELECT missionID FROM mission 
                WHERE userID = ? 
                AND missionType = 'Comment on any Content' 
                AND xpEarned = 0 
                AND completedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                LIMIT 1
            `;
            
            db.query(checkMissionSql, [userID], (mErr, mRows) => {
                const missionCompleted = !mErr && mRows.length > 0;
                
                // Trigger mission completion for commenting
                missionController.completeMission(userID, 'Comment on any Content');
                
                // Redirect with mission parameter if completed
                if (missionCompleted) {
                    res.redirect(`/content/${contentID}?success=posted&mission=complete`);
                } else {
                    res.redirect(`/content/${contentID}?success=posted`);
                }
            });
        });

    } catch (error) {
        console.error("❌ AI moderation error:", error);
        console.error("❌ Error type:", error.constructor.name);
        console.error("❌ Error message:", error.message);
        console.error("❌ Full error stack:", error.stack);
        return res.redirect(`/content/${contentID}?error=moderation_fail`);
    }
};


exports.trackShare = (req, res) => {
  if (!req.session.user) {
        return res.status(401).json({ success: false });
    }

    const userID = req.session.user.userID;
    const contentID = req.params.contentID;

    const updateSql = `
        UPDATE engagement
        SET share = share + 1
        WHERE userID = ? AND contentID = ?
    `;

    const insertSql = `
        INSERT INTO engagement (userID, contentID, share)
        VALUES (?, ?, 1)
    `;

    db.query(updateSql, [userID, contentID], (err, result) => {
        if (err) return res.status(500).json({ success: false });
        
        if (result.affectedRows === 0) {
            db.query(insertSql, [userID, contentID], err2 => {
                if (err2) return res.status(500).json({ success: false });
                
                // Check if mission exists before completing
                const checkMissionSql = `
                    SELECT missionID FROM mission 
                    WHERE userID = ? 
                    AND missionType = 'Share 1 Sustainability Post' 
                    AND xpEarned = 0 
                    AND completedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    LIMIT 1
                `;
                
                db.query(checkMissionSql, [userID], (mErr, mRows) => {
                    const missionCompleted = !mErr && mRows.length > 0;
                    
                    // Trigger mission completion
                    missionController.completeMission(userID, 'Share 1 Sustainability Post');
                    
                    return res.json({ success: true, missionCompleted: missionCompleted });
                });
            });
        } else {
            // Check if mission exists before completing
            const checkMissionSql = `
                SELECT missionID FROM mission 
                WHERE userID = ? 
                AND missionType = 'Share 1 Sustainability Post' 
                AND xpEarned = 0 
                AND completedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                LIMIT 1
            `;
            
            db.query(checkMissionSql, [userID], (mErr, mRows) => {
                const missionCompleted = !mErr && mRows.length > 0;
                
                // Trigger mission completion
                missionController.completeMission(userID, 'Share 1 Sustainability Post');
                
                return res.json({ success: true, missionCompleted: missionCompleted });
            });
        }
    });
};


exports.getContent = (req, res) => {
    const contentID = req.params.id;
    const userID = req.session.user ? req.session.user.userID : 0;
    const userRole = req.session.user ? req.session.user.userType : 'User';

    const sort = req.query.sort || "newest";

    let orderBy = "e.createdAt DESC"; 

    if (sort === "oldest") {
        orderBy = "e.createdAt ASC";
    } else if (sort === "az") {
        orderBy = "u.userName ASC";
    } else if (sort === "za") {
        orderBy = "u.userName DESC";
    }

    const contentSql = `
        SELECT c.*, cat.contentTypeName, cat.contentTypeDescription, cat.contentTypeImage
        FROM content c
        JOIN content_type cat ON c.contentTypeID = cat.contentTypeID
        WHERE c.contentID = ?
    `;

    const commentSql = `
        SELECT 
                e.engagementID AS commentID,
                e.comments AS commentText,
                e.isBlocked,
                DATE_FORMAT(e.createdAt, '%d %b %Y, %h:%i %p') AS createdAt,
                u.userID,
                u.userName,
                u.userType,
                u.image AS userImage
            FROM engagement e
            JOIN user u ON e.userID = u.userID
            WHERE e.contentID = ?
                AND (
                e.isBlocked = 0
                OR e.userID = ?
                OR ? IN ('Admin', 'Manager')
                )
            ORDER BY ${orderBy}
        `;

    const likeSql = `
        SELECT COUNT(*) AS likeCount
        FROM engagement
        WHERE contentID = ? AND likes = 1
    `;

    const currentLang = req.session.language || req.cookies.language || 'en';

    db.query(contentSql, [contentID], async (err, contentRows) => {
        if (err) return res.status(500).send("Error loading content");

        if (contentRows.length === 0) {
            return res.status(404).send("Content not found");
        }

        let content = contentRows[0];

        if (currentLang !== 'en') {
            console.log('🔄 Translating content to:', currentLang);
            content.contentTitle = await translateText(content.contentTitle, currentLang);
            content.contentDescription = await translateText(content.contentDescription, currentLang);
            content.contentTypeName = await translateText(content.contentTypeName, currentLang);
            content.contentTypeDescription = await translateText(content.contentTypeDescription, currentLang);
        }

        const viewerUserID = req.session.user ? req.session.user.userID : 0;
        const viewerRole = req.session.user ? req.session.user.userType : 'User';

        console.log("👀 Viewer:", {
            viewerUserID,
            viewerRole
        });

        db.query(
            commentSql,
            [contentID, viewerUserID, viewerRole],
            async (err2, comments) => {
                if (err2) { 
                    console.log("🔥 COMMENT SQL ERROR:", err2);
                    return res.status(500).send("Error loading comments");
                }

                if (currentLang !== 'en' && comments && comments.length > 0) {
                    console.log('🔄 Translating comments to:', currentLang);
                    for (let comment of comments) {
                        if (comment.commentText && !comment.isBlocked) {
                            comment.commentText = await translateText(comment.commentText, currentLang);
                        }
                    }
                }

                db.query(likeSql, [contentID], (err3, likeRows) => {
                    if (err3) return res.status(500).send("Error loading likes");

                    const likeCount = likeRows[0].likeCount;

                    res.render("viewContent", {
                        content,
                        comments: comments || [],
                        likeCount,
                        sessionUser: req.session.user || null,
                        sort
                    });
                });
            }
        );
    });
};


exports.blockComment = (req, res) => {
  const commentID = req.params.id;
  const contentID = req.body.contentID;
  const userType = req.session.user.userType;

  if (!['Admin', 'Manager'].includes(userType)) {
    return res.status(403).send('Forbidden');
  }

  const sql = `
    UPDATE engagement
    SET isBlocked = 1
    WHERE engagementID = ?
  `;

  db.query(sql, [commentID], () => {
        res.redirect(`/content/${contentID}?moderation=blocked`);
    });
};


exports.unblockComment = (req, res) => {
  const commentID = req.params.commentID;
  const userType = req.session.user.userType;
  const contentID = req.body.contentID; 

  if (!['Admin', 'Manager'].includes(userType)) {
    return res.status(403).send('Forbidden');
  }

  const sql = `
    UPDATE engagement
    SET isBlocked = 0
    WHERE engagementID = ?
  `;

  db.query(sql, [commentID], (err) => {
    if (err) {
      console.error("Unblock error:", err);
      return res.status(500).send("Failed to unblock comment");
    }

    res.redirect(`/content/${contentID}?moderation=unblocked`);
  });
};


exports.editComment = (req, res) => {
    const commentID = req.params.commentID;
    const userID = req.session.user.userID;
    const updatedText = req.body.updatedText;

    if (!updatedText || updatedText.trim() === "") {
        return res.redirect("back");
    }

    const getSQL = `
        SELECT contentID
        FROM engagement 
        WHERE engagementID = ? AND userID = ?
    `;

    db.query(getSQL, [commentID, userID], (err, rows) => {
        if (err || rows.length === 0) {
            return res.redirect("back");
        }

        const contentID = rows[0].contentID;

        const updateSQL = `
            UPDATE engagement 
            SET comments = ?
            WHERE engagementID = ? AND userID = ?
        `;

        db.query(updateSQL, [updatedText.trim(), commentID, userID], (err2) => {
            if (err2) return res.status(500).send("Failed to update");

            res.redirect(`/content/${contentID}?success=edited`);
        });
    });
};


exports.deleteComment = (req, res) => {
    const commentID = req.params.commentID;
    const userID = req.session.user.userID;

    const sqlGet = `
        SELECT contentID
        FROM engagement 
        WHERE engagementID = ? AND userID = ?
    `;

    db.query(sqlGet, [commentID, userID], (err, rows) => {
        if (err || rows.length === 0) {
            return res.redirect('back');
        }

        const contentID = rows[0].contentID;

        const sqlDelete = `
            DELETE FROM engagement 
            WHERE engagementID = ? AND userID = ?
        `;

        db.query(sqlDelete, [commentID, userID], (delErr) => {
            if (delErr) {
                return res.status(500).send('Failed to delete comment');
            }

            res.redirect(`/content/${contentID}`);
        });
    });
};


exports.addContentForm = (req, res) => {
    const sql = 'SELECT * FROM content_type';
    const user = req.session.user;
    db.query(sql, (error, results) => {
        if (error) {
            console.error("Error fetching categories:", error);
            res.status(500).send('Error loading page');
        } else {
            res.render('addContent', { user, categories: results });
        }
    });
};


exports.addContent = (req, res) => {
    const { contentTypeID, contentTitle, contentDescription, publishNow } = req.body;
    const contentFile = req.file ? req.file.path : null;
    const userType = req.session.user?.userType;

    // Only Writer can publish content
    if (userType !== 'Writer') {
        req.flash('error', 'Only Writers can publish content. Admins and Managers can only approve/reject.');
        return res.redirect('/manageContent');
    }

    // Step 1: Insert content into content table
    const insertContentSql = 'INSERT INTO content (contentTypeID, contentTitle, contentDescription, contentFile) VALUES (?, ?, ?, ?)';
   
    db.query(insertContentSql, [contentTypeID, contentTitle, contentDescription, contentFile], (error, results) => {
        if (error) {
            console.error("Error adding content:", error);
            return res.status(500).send('Error adding content');
        }

        const contentID = results.insertId;

        // If Writer chooses to publish directly (no approval needed)
        if (publishNow === 'true') {
            req.flash('success', 'Content published successfully!');
            return res.redirect('manageContent');
        }

        // Otherwise, submit for approval
        // Step 2: Create content request with 'pending' status
        // Try without created_at first, it may be auto-generated
        const insertRequestSql = 'INSERT INTO content_request (contentID, status) VALUES (?, ?)';
        
        console.log('🔄 Inserting content request for contentID:', contentID);
        
        db.query(insertRequestSql, [contentID, 'pending'], (requestError) => {
            if (requestError) {
                console.error("❌ Error creating content request:", requestError);
                console.error("❌ SQL State:", requestError.sqlState);
                console.error("❌ Error Code:", requestError.code);
                console.error("❌ Error Message:", requestError.message);
                req.flash('error', 'Content added but approval request failed. Error: ' + requestError.message);
                return res.redirect('manageContent');
            }

            // Step 3: Send notification email to manager (cc admin)
            sendContentNotificationEmail(contentTitle, contentDescription, contentID, req.session.user?.userName);

            req.flash('success', 'Content submitted successfully! It is now pending manager approval.');
            res.redirect('manageContent');
        });
    });
};

// Helper function to send content notification email
function sendContentNotificationEmail(contentTitle, contentDescription, contentID, writerName) {
    // Get manager and admin emails to send notification
    const getEmailsSql = `
        SELECT u.email, u.userName, u.userType
        FROM user u 
        WHERE u.userType IN ('Manager', 'Admin')
        ORDER BY u.userType DESC
    `;

    db.query(getEmailsSql, async (emailError, emailResults) => {
        if (!emailError && emailResults.length > 0) {
            // Separate manager and admin emails
            const managers = emailResults.filter(u => u.userType === 'Manager');
            const admins = emailResults.filter(u => u.userType === 'Admin');
            
            // Send to all managers, CC all admins
            const managerEmails = managers.map(m => m.email);
            const adminEmails = admins.map(a => a.email);
            
            // If no managers, send to admins instead
            const toAddresses = managerEmails.length > 0 ? managerEmails.join(',') : adminEmails.join(',');
            const ccAddresses = managerEmails.length > 0 && adminEmails.length > 0 ? adminEmails.join(',') : '';
            
            if (toAddresses) {
                // Send email to manager with admin CC'd
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });

                const appUrl = process.env.APP_URL || 'http://localhost:3000';

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: toAddresses,
                    cc: ccAddresses,
                    subject: 'New Content Submission for Approval - RPEcoJourney',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                            <h2 style="color: #003b2b; border-bottom: 2px solid #28a745; padding-bottom: 10px;">📝 New Content Submission</h2>
                            
                            <p style="font-size: 16px; color: #333;">Hello,</p>
                            
                            <p style="font-size: 16px; color: #333;">
                                A new content submission from <strong>${writerName || 'a writer'}</strong> requires your review and approval.
                            </p>
                            
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>📌 Title:</strong> ${contentTitle}</p>
                                <p style="margin: 5px 0;"><strong>📄 Description:</strong> ${contentDescription}</p>
                                <p style="margin: 5px 0;"><strong>🆔 Content ID:</strong> #${contentID}</p>
                            </div>
                            
                            <p style="font-size: 16px; color: #666;">
                                Please log in to the RPEcoJourney portal to review and approve or reject this content submission.
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${appUrl}/content-requests" 
                                   style="display: inline-block; padding: 12px 30px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                                    Log In to Review
                                </a>
                            </div>
                            
                            <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                                This is an automated notification from RPEcoJourney. Please do not reply to this email.
                            </p>
                        </div>
                    `
                };

                transporter.sendMail(mailOptions, (emailError, info) => {
                    if (emailError) {
                        console.error('❌ Error sending content request email:', emailError);
                    } else {
                        console.log('✅ Content request email sent:', info.response);
                    }
                });
            } else {
                console.error('⚠️ No manager or admin emails found to send notification');
            }
        } else {
            console.error('⚠️ Error fetching manager/admin emails:', emailError);
        }
    });
}


const getAllCategories = (db, callback) => {
    const sql = 'SELECT * FROM content_type';

    db.query(sql, (error, results) => {
        if (error) {
            return callback(error, null); 
        }

        if (results.length > 0) {
            return callback(null, results);
        } else {
            return callback(null, []); 
        }
    });
};


exports.editContentForm = async (req, res) => {
    const contentID = req.params.id;
    getAllCategories(db, (categoriesError, categories) => {
        if (categoriesError) {
            console.error('Error retrieving categories:', categoriesError.message);
            return res.status(500).send('Error retrieving categories');
        }

        const sql = 'SELECT * FROM content WHERE contentID = ?';
        db.query(sql, [contentID], (contentError, results) => {
            if (contentError) {
                console.error('Database query error:', contentError.message);
                return res.status(500).send('Error retrieving content by ID');
            }

            if (results.length > 0) {
                res.render('editContent', { content: results[0], categories: categories });
            } else {
                res.status(404).send('Content not found');
            }
        });
    });

};

exports.editContent = (req, res) => {
  const contentID = req.params.id;
  const { contentTypeID, contentTitle, contentDescription } = req.body;
  
  const ALLOWED_EXTENSIONS = ['jpg','jpeg','png','gif','webp','mp4','mov','avi','pdf','doc','docx','ppt','pptx'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  if (req.file) {
    const fileName = req.file.originalname.toLowerCase();
    const ext = fileName.split('.').pop();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      req.flash('error', `File type ".${ext}" not allowed.`);
      return res.redirect(`/editContent/${contentID}`);
    }

    if (req.file.size > MAX_FILE_SIZE) {
      req.flash('error', 'File size exceeds 10MB limit.');
      return res.redirect(`/editContent/${contentID}`);
    }
  }

  db.query('SELECT contentFile FROM content WHERE contentID = ?', [contentID], async (err, rows) => {
    if (err) {
      req.flash('error', 'Error updating content');
      return res.redirect(`/editContent/${contentID}`);
    }

    const oldFile = rows[0]?.contentFile;

    if (req.file && oldFile) {
      const publicIdMatch = oldFile.match(/\/(?:image|raw|video)\/upload\/v\d+\/(.*)$/);
      if (publicIdMatch) {
        const publicId = publicIdMatch[1];
        try {
          await new Promise((resolve, reject) => {
            cloudinary.uploader.destroy(publicId, { invalidate: true }, (error, result) => {
              if (error) reject(error);
              else resolve(result);
            });
          });
          console.log(`✅ Deleted old file: ${publicId}`);
        } catch (deleteError) {
          console.error('⚠️  Error deleting old file:', deleteError.message);
          
        }
      }
    }

    const contentFile = req.file ? req.file.path : oldFile;
    
    const sql = 'UPDATE content SET contentTypeID = ?, contentTitle = ?, contentDescription = ?, contentFile = ? WHERE contentID = ?';
    db.query(sql, [contentTypeID, contentTitle, contentDescription, contentFile, contentID], (error) => {
      if (error) {
        console.error("Error updating:", error);
        req.flash('error', 'Error updating content');
        res.redirect(`/editContent/${contentID}`);
      } else {
        req.flash('success', 'Content updated successfully!');
        res.redirect('/manageContent');
      }
    });
  });
};

exports.deleteContent = async (req, res) => {
    const contentID = req.params.id;
    
    try {
        const getContentSql = 'SELECT contentFile FROM content WHERE contentID = ?';
        const [getResults] = await db.promise().query(getContentSql, [contentID]);
        
        if (getResults.length === 0) {
            req.flash('error', 'Content not found');
            return res.redirect('/manageContent');
        }
        
        const contentFile = getResults[0].contentFile;
        
        const publicIdMatch = contentFile.match(/\/(?:image|raw|video)\/upload\/v\d+\/(.*)$/);
        
        if (publicIdMatch) {
            const publicId = publicIdMatch[1];
            
            try {
                await new Promise((resolve, reject) => {
                    cloudinary.uploader.destroy(publicId, { 
                        invalidate: true,
                        resource_type: 'auto'
                    }, (error, result) => {
                        if (error) {
                            console.error('❌ Error deleting file:', error);
                            reject(error);
                        } else {
                            console.log(`✅ Deleted from Cloudinary: ${publicId}`);
                            resolve(result);
                        }
                    });
                });
            } catch (deleteError) {
                console.error('⚠️  Error deleting from Cloudinary:', deleteError.message);
            }
        } else {
            console.warn('⚠️  Could not extract public_id from URL:', contentFile);
        }
        
        const deleteSql = 'DELETE FROM content WHERE contentID = ?';
        await db.promise().query(deleteSql, [contentID]);
        
        req.flash('success', 'Content deleted successfully!');
        res.redirect('/manageContent');
        
    } catch (error) {
        console.error("❌ Error deleting content:", error);
        req.flash('error', 'Error deleting content');
        res.redirect('/manageContent');
    }
};

exports.manageContent = (req, res) => {
    const sql = `
        SELECT *
        FROM content c
        JOIN content_type cat ON c.contentTypeID = cat.contentTypeID
    `;

    db.query(sql, (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error retrieving contents');
        }

        if (results.length > 0) {
            res.render('manageContent', { 
                content: results,
                user: req.session.user,
                flashSuccess: req.flash("success"),
                flashError: req.flash("error") 
            });
        } else {
            res.render('manageContent', { 
                content: [],
                user: req.session.user,
                flashSuccess: req.flash("success"),
                flashError: req.flash("error") 
            });
        }
    });
};

// ============================
// GET CONTENT REQUESTS
// ============================
exports.getContentRequests = async (req, res) => {
    console.log('📋 getContentRequests called');
    console.log('User:', req.session.user?.userName, 'Type:', req.session.user?.userType);
    
    try {
        // Join with content table to show details
        const sql = `
            SELECT 
                cr.contentRequestID,
                cr.contentID,
                cr.status,
                cr.created_at,
                c.contentTitle,
                c.contentDescription,
                c.contentFile,
                ct.contentTypeName
            FROM content_request cr
            JOIN content c ON cr.contentID = c.contentID
            LEFT JOIN content_type ct ON c.contentTypeID = ct.contentTypeID
            WHERE cr.status = 'pending'
            ORDER BY cr.created_at DESC
            LIMIT 100
        `;

        db.query(sql, (error, pendingRequests) => {
            if (error) {
                console.error('❌ Query Error:', error.message);
                console.error('❌ Full Error:', error);
                // Still render the page even if query fails
                return res.render('contentRequests', { 
                    requests: [],
                    flashSuccess: req.flash('success'),
                    flashError: req.flash('error')
                });
            }

            console.log('✅ Query successful - found', pendingRequests?.length || 0, 'pending requests');

            // Render page with whatever we have
            res.render('contentRequests', { 
                requests: pendingRequests || [],
                flashSuccess: req.flash('success'),
                flashError: req.flash('error')
            });
        });
    } catch (error) {
        console.error('❌ Exception in getContentRequests:', error);
        res.render('contentRequests', { 
            requests: [],
            flashSuccess: req.flash('success'),
            flashError: req.flash('error')
        });
    }
};

// ============================
// APPROVE CONTENT REQUEST
// ============================
exports.approveContentRequest = async (req, res) => {
    try {
        const contentRequestID = req.params.id;
        
        // Update content_request status to 'approved'
        const updateSql = `UPDATE content_request SET status = 'approved' WHERE contentRequestID = ?`;
        
        db.query(updateSql, [contentRequestID], async (error, result) => {
            if (error) {
                console.error('Error approving content:', error);
                req.flash('error', 'Error approving content');
                return res.redirect('/content-requests');
            }

            req.flash('success', 'Content approved successfully!');
            res.redirect('/content-requests');
        });
    } catch (error) {
        console.error('Error in approveContentRequest:', error);
        req.flash('error', 'Error approving content');
        res.redirect('/content-requests');
    }
};

// ============================
// REJECT CONTENT REQUEST
// ============================
exports.rejectContentRequest = async (req, res) => {
    try {
        const contentRequestID = req.params.id;
        
        // Update content_request status to 'rejected'
        const updateSql = `UPDATE content_request SET status = 'rejected' WHERE contentRequestID = ?`;
        
        db.query(updateSql, [contentRequestID], async (error, result) => {
            if (error) {
                console.error('Error rejecting content:', error);
                req.flash('error', 'Error rejecting content');
                return res.redirect('/content-requests');
            }

            req.flash('success', 'Content rejected successfully!');
            res.redirect('/content-requests');
        });
    } catch (error) {
        console.error('Error in rejectContentRequest:', error);
        req.flash('error', 'Error rejecting content');
        res.redirect('/content-requests');
    }
};