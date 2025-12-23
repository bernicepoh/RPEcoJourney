const db = require('../db');
const nodemailer = require('nodemailer');

// ============================
// GET CONTENT BY content_type
// ============================
exports.getContentBycontent_type = (req, res) => {
    const contentTypeID = req.params.id;
    const userID = req.session.user ? req.session.user.userID : 0; // if no login, treat as 0

    const sql = `SELECT 
                    c.contentID, 
                    c.contentTitle, 
                    c.contentDescription, 
                    c.contentFile,
                    cat.content_typeName,
                    cat.content_typeDescription,
                    cat.content_typeImage,
                    cat.userID AS content_typeOwnerID,
                    u.userName AS content_typeOwnerName,
                    u.image AS content_typeOwnerPic,

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
                LEFT JOIN user u ON cat.userID = u.userID
                WHERE cat.contentTypeID = ?
            `;

    db.query(sql, [userID, contentTypeID], (error, results) => {
        if (error) {
            console.log("🔥 SQL ERROR:", error);
            return res.status(500).send('Error retrieving content');
        }
        if (results.length > 0) {
            // Use data from first item for content_type info
            const content_typeInfo = {
                content_typeName: results[0].content_typeName,
                content_typeDescription: results[0].content_typeDescription,
                content_typeImage: results[0].content_typeImage,
                content_typeOwnerName: results[0].content_typeOwnerName || "content_type Manager",
                content_typeOwnerPic: results[0].content_typeOwnerPic || "defaultUser.png"
            };
            res.render('viewContentBycontent_type', {
                content_type: content_typeInfo,
                contentList: results,
                user: req.session.user || null
            });
        } else {
            // No content, but still try to get content_type info for banner, etc.
            const catSql = 'SELECT * FROM content_type WHERE contentTypeID = ?';
            db.query(catSql, [contentTypeID], (catError, catRows) => {
                if (catError || catRows.length === 0) {
                    return res.status(404).send('content_type not found');
                }
                const content_typeInfo = {
                    content_typeName: catRows[0].content_typeName,
                    content_typeDescription: catRows[0].content_typeDescription,
                    content_typeImage: catRows[0].content_typeImage,
                    categiryOwnerName: catRows[0].content_typeOwnerName || "content_type Manager",
                    content_typeOwnerPic: catRows[0].content_typeOwnerPic || "defaultUser.png",
                };
                res.render('viewContentBycontent_type', {
                    content_type: content_typeInfo,
                    contentList: [],
                    user: req.session.user || null
                });
                // // After we get content list, fetch likers for ALL content
                // const likerSql = `
                //     SELECT e.contentID, u.userID, u.userName, u.profilePic
                //     FROM engagement e
                //     JOIN user u ON u.userID = e.userID
                //     WHERE e.likes = 1
                // `;

                // db.query(likerSql, (err2, likerRows) => {
                //     if (err2) {
                //         console.error("Error loading liker list:", err2);
                //         return res.status(500).send("Error retrieving likes");
                //     }

                //     // Attach likers to each content item
                //     const updatedContentList = results.map(content => {
                //         return {
                //             ...content,
                //             likers: likerRows.filter(l => l.contentID == content.contentID)
                //         };
                //     });

                //     res.render('viewContentBycontent_type', {
                //         content_type: content_typeInfo,
                //         contentList: updatedContentList,
                //         user: req.session.user || null
                //     });
                //});
            });
        }
    });
};

// ============================
// TOGGLE LIKE (Correct Version)
// ============================
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
                        likeCount: countRows[0].likeCount
                    });
                });
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
                        likeCount: countRows[0].likeCount
                    });
                });
            });
        }
    });
};

// exports.getLikesList = (req, res) => {
//     const contentID = req.params.id;

//     const sql = `
//         SELECT u.userName, u.profilePic, u.userID
//         FROM engagement e
//         JOIN user u ON e.userID = u.userID
//         WHERE e.contentID = ? AND e.likes = 1
//     `;

//     db.query(sql, [contentID], (err, rows) => {
//         if (err) return res.status(500).json({ success: false });

//         res.json({
//             success: true,
//             users: rows
//         });
//     });
// };

// ============================
// POSTING OF COMMENT 
// ============================
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.postComment = async (req, res) => {
    const contentID = req.params.id;
    const userID = req.session.user.userID;
    const commentText = req.body.commentText;

    // manual profanity filter (regex for variations)
    const profanityRegex = /\b(f+[\W_]*u+[\W_]*c+[\W_]*k+|s+[\W_]*h+[\W_]*i+[\W_]*t+|b+[\W_]*i+[\W_]*t+[\W_]*c+[\W_]*h+|a+[\W_]*s+[\W_]*s+[\W_]*h+[\W_]*o+[\W_]*l+e+)\b/gi;

    if (profanityRegex.test(commentText)) {
        return res.redirect(`/content/${contentID}?error=inappropriate`);
    }

    try {
        // ============================
        // GPT-4o-mini Moderation
        // ============================
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
                    You are a strict moderation system. 
                    Your job is to classify the user's comment. 
                    If the comment contains ANY of these:
                    - hate speech
                    - harassment or bullying
                    - sexual or NSFW content
                    - violence
                    - threats
                    - self-harm mention
                    - spam or scams
                    - profanity or offensive language (e.g., curse words)
                    - rude or disrespectful expressions

                    Respond ONLY with: "unsafe"
                    Otherwise, respond ONLY: "safe"
                    `
                },
                { role: "user", content: commentText }
            ]
        });

        const result = response.choices[0].message.content.trim();
        const flagged = (result === "unsafe");

        if (flagged) {
            // AI says inappropriate
            return res.redirect(`/content/${contentID}?error=inappropriate`);
        }

        // =================================
        // Inserting of Clean Comment to DB
        // =================================
        const sql = `
            INSERT INTO engagement (userID, contentID, comments, share) 
            VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [userID, contentID, commentText, 0], (err) => {
            if (err) return res.status(500).send("Failed to post comment");
            res.redirect(`/content/${contentID}?success=posted`);
        });

    } catch (error) {
        console.error("AI moderation error:", error);
        return res.redirect(`/content/${contentID}?error=moderation_fail`);
    }
};

// ============================
// SHARE BUTTON
// ============================
exports.trackShare = (req, res) => {
    const userID = req.session.user.userID;
    const contentID = req.params.contentID;

    const sql = `
        UPDATE engagement
        SET share = share + 1
        WHERE userID = ? AND contentID = ?
        LIMIT 1
    `;

    const insertSql = `
        INSERT INTO engagement (userID, contentID, share)
        VALUES (?, ?, 1)
    `;

    // First try to update existing row
    db.query(sql, [userID, contentID], (err, result) => {
        if (err) return res.status(500).json({ success: false });

        if (result.affectedRows === 0) {
            // No row exists → insert new one
            db.query(insertSql, [userID, contentID], (err2) => {
                if (err2) return res.status(500).json({ success: false });
                return res.json({ success: true });
            });
        } else {
            // Updated existing row
            return res.json({ success: true });
        }
    });
};

exports.getContent = (req, res) => {
    const contentID = req.params.id;

    const contentSql = `
        SELECT c.*, cat.content_typeName, cat.content_typeDescription, cat.content_typeImage
        FROM content c
        JOIN content_type cat ON c.contentTypeID = cat.contentTypeID
        WHERE c.contentID = ?
    `;

    const commentSql = `
        SELECT 
            e.engagementID AS commentID,
            e.comments AS commentText,
            e.createdAt,
            u.userID,
            u.userName,
            u.image AS userImage
        FROM engagement e
        JOIN user u ON e.userID = u.userID
        WHERE e.contentID = ? AND e.comments IS NOT NULL AND e.comments != ''
        ORDER BY e.createdAt DESC
    `;

    const likeSql = `
        SELECT COUNT(*) AS likeCount
        FROM engagement
        WHERE contentID = ? AND likes = 1
    `;

    db.query(contentSql, [contentID], (err, contentRows) => {
        if (err) return res.status(500).send("Error loading content");

        if (contentRows.length === 0) {
            return res.status(404).send("Content not found");
        }

        const content = contentRows[0];

        db.query(commentSql, [contentID], (err2, comments) => {
            if (err2) return res.status(500).send("Error loading comments");

            db.query(likeSql, [contentID], (err3, likeRows) => {
                if (err3) return res.status(500).send("Error loading likes");

                const likeCount = likeRows[0].likeCount;

                res.render("viewContent", {
                    content,
                    comments,
                    likeCount,
                    sessionUser: req.session.user || null   // <-- FIX HERE
                });
            });
        });
    });
};



exports.editComment = (req, res) => {
    const commentID = req.params.commentID;
    const userID = req.session.user.userID;
    const updatedText = req.body.updatedText;

    if (!updatedText || updatedText.trim() === "") {
        return res.redirect("back");
    }

    // First get the contentID of this comment
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

        // Update the comment
        const updateSQL = `
            UPDATE engagement 
            SET comments = ?
            WHERE engagementID = ? AND userID = ?
        `;

        db.query(updateSQL, [updatedText.trim(), commentID, userID], (err2) => {
            if (err2) return res.status(500).send("Failed to update");

            // Redirect back to the SAME content page
            res.redirect(`/content/${contentID}`);
        });
    });
};

exports.deleteComment = (req, res) => {
    const commentID = req.params.commentID;
    const userID = req.session.user.userID;

    // 1) Get contentID first
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

        // 2) Delete the comment
        const sqlDelete = `
            DELETE FROM engagement 
            WHERE engagementID = ? AND userID = ?
        `;

        db.query(sqlDelete, [commentID, userID], (delErr) => {
            if (delErr) {
                return res.status(500).send('Failed to delete comment');
            }

            // 3) Redirect user back to content page
            res.redirect(`/content/${contentID}`);
        });
    });
};

exports.addContentForm = (req, res) => {
    const sql = 'SELECT * FROM content_type';
    const user = req.session.user 
    db.query(sql, (error, results) => {
        if (error) {
            console.error("Error fetching categories:", error);
            res.status(500).send('Error loading page');
        } else {
            // pass the categories to the EJS template
            res.render('addContent', { user, categories: results });
        }
    });
};

exports.addContent = (req, res) => {
    const { contentTypeID, contentTitle, contentDescription } = req.body;
    let contentFile;
    if (req.file) {
        contentFile = req.file.filename; // Save only the filename
    } else {
        contentFile = null;
    }

    const sql = 'INSERT INTO content (contentTypeID, contentTitle, contentDescription, contentFile) VALUES (?, ?, ?, ?)';
   

    // Insert the new content into the database
    db.query(sql, [contentTypeID, contentTitle, contentDescription, contentFile], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding content:", error);
            res.status(500).send('Error adding content');
        } else {
            // Send a success response
            res.redirect('manageContent');
        }
    });
};

const getAllContent = (db, callback) => {
    const sql = 'SELECT * FROM content_type';

    // Fetch data from MySQL
    db.query(sql, (error, results) => {
        if (error) {
            return callback(error, null); // Call callback with error
        }

        if (results.length > 0) {
            return callback(null, results); // Call callback with categories
        } else {
            return callback(null, []); // No categories found, return empty array
        }
    });
};

exports.editContentForm = async (req, res) => {
    const contentID = req.params.id;
    // First, fetch the categories
    getAllCategories(db, (categoriesError, categories) => {
        if (categoriesError) {
            console.error('Error retrieving categories:', categoriesError.message);
            return res.status(500).send('Error retrieving categories');
        }

        // Once categories are fetched, fetch the product by ID
        const sql = 'SELECT * FROM content WHERE contentID = ?';
        db.query(sql, [contentID], (contentError, results) => {
            if (contentError) {
                console.error('Database query error:', contentError.message);
                return res.status(500).send('Error retrieving content by ID');
            }

            // Check if any product with the given ID was found
            if (results.length > 0) {
                // Render HTML page with the product and categories data
                res.render('editContent', { content: results[0], categories: categories });
            } else {
                // If no product with the given ID was found, handle accordingly
                res.status(404).send('Content not found');
            }
        });
    });

};

exports.editContent = (req, res) => {

    const contentID = req.params.id;
    const { contentTypeID, contentTitle, contentDescription } = req.body;
    let contentFile = req.body.currentFile; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        contentFile = req.file.filename; // set image to be new image filename
    }
    console.log("new file: " + contentFile);
    const sql = 'UPDATE content SET contentTypeID = ?, contentTitle = ?, contentDescription = ?, contentFile = ? WHERE contentID = ?';

    // Updated the content into the database
    db.query(sql, [contentTypeID, contentTitle, contentDescription, contentFile, contentID], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error updating content:", error);
            res.status(500).send('Error updating content');
        } else {
            // Send a success response
            req.flash('success', 'Content updated successfully!');
            res.redirect(`/manageContent`);

        }
    });
};

exports.deleteContent = (req, res) => {
    const contentID = req.params.id;
    // First, get the contentTypeID of the content
    const getcontent_typeSql = 'SELECT contentTypeID FROM content WHERE contentID = ?';
    db.query(getcontent_typeSql, [contentID], (getError, getResults) => {
        if (getError) {
            console.error("Error fetching contentTypeID:", getError);
            return res.status(500).send('Error deleting content');
        }
        if (getResults.length === 0) {
            return res.status(404).send('Content not found');
        }
        const contentTypeID = getResults[0].contentTypeID;
        // Now delete the content
        const deleteSql = 'DELETE FROM content WHERE contentID = ?';
        db.query(deleteSql, [contentID], (deleteError, deleteResults) => {
            if (deleteError) {
                console.error("Error deleting content:", deleteError);
                return res.status(500).send('Error deleting content');
            } else {
                // Redirect to viewContentBycontent_type for the content_type
                req.flash('success', 'Content deleted successfully!');
                res.redirect(`/manageContent`);
            }
        });
    });
};

// contentController.js
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
            flashSuccess: req.flash("success"),
            flashError: req.flash("error") });
        } else {
            res.status(404).send('No content');
        }
    });
};


// exports.postForgotPassword = (req, res) => {
//     const { email } = req.body;

//     if (!email) {
//         req.flash('error', 'Please enter your email.');
//         return res.redirect('/forgot-password');
//     }

//     db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
//         if (err) throw err;

//         if (results.length === 0) {
//             req.flash('error', 'Email not found.');
//             return res.redirect('/forgot-password');
//         }

//         const tempPassword = generateTempPassword(8);

        
//         db.query('UPDATE users SET password = SHA(?) WHERE email = ?', [tempPassword, email], (err) => {
//             if (err) throw err;

//             // Configure mail
//             const transporter = nodemailer.createTransport({
//                 service: 'gmail',
//                 auth: {
//                     user: 'fyptesting13@gmail.com',
//                     pass: 'fjbjltcfxfofwiho' 
//                 }
//             });

//             const mailOptions = {
//                 from: 'fyptesting13@gmail.com',
//                 to: email,
//                 subject: 'Temporary Password',
//                 text: Your temporary password is: ${tempPassword}\nPlease use this to log in and reset your password.
//             };

//             // Send email
//             transporter.sendMail(mailOptions, (error) => {
//                 if (error) {
//                     console.log(error);
//                     req.flash('error', 'Error sending email.');
//                     return res.redirect('/forgot-password');
//                 }

//                 // Render page showing step 2
//                 res.render('forgot_password', { 
//                     step: 2,
//                     email: email,
//                     errors: [],
//                     success: ['Temporary password sent to your email.']
//                 });
//             });
//         });
//     });
// };