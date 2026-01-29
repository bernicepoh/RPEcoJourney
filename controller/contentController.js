const db = require('../db');
const nodemailer = require('nodemailer');
const { isUnsafeComment } = require("../hfModeration");

// ============================
// GET CONTENT BY content_type
// ============================
exports.getContentByContentType = (req, res) => {
    const contentTypeID = req.params.id;
    const userID = req.session.user ? req.session.user.userID : 0; // if no login, treat as 0

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
                WHERE cat.contentTypeID = ?
            `;

    db.query(sql, [userID, contentTypeID], (error, results) => {
        if (error) {
            console.log("🔥 SQL ERROR:", error);
            return res.status(500).send('Error retrieving content');
        }
        if (results.length > 0) {
            // Use data from first item for content type info
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
            // No content, but still try to get content_type info for banner, etc.
            const catSql = 'SELECT * FROM content_type WHERE contentTypeID = ?';
            db.query(catSql, [contentTypeID], (catError, catRows) => {
                if (catError || catRows.length === 0) {
                    return res.status(404).send('content type not found');
                }
                const contentTypeInfo = {
                    contentTypeName: catRows[0].contentTypeName,
                    contentTypeDescription: catRows[0].contentTypeDescription,
                    contentTypeImage: catRows[0].contentTypeImage,
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
exports.postComment = async (req, res) => {
    const contentID = req.params.id;
    const userID = req.session.user.userID;
    const commentText = req.body.commentText;

    const profanityRegex = /\b(f+[\W_]*u+[\W_]*c+[\W_]*k+|s+[\W_]*h+[\W_]*i+[\W_]*t+|b+[\W_]*i+[\W_]*t+[\W_]*c+[\W_]*h+|a+[\W_]*s+[\W_]*s+[\W_]*h+[\W_]*o+[\W_]*l+e+)\b/gi;

    if (profanityRegex.test(commentText)) {
        return res.redirect(`/content/${contentID}?error=inappropriate`);
    }

    try {
        // ============================
        // Hugging Face Moderation
        // ============================
        const flagged = await isUnsafeComment(commentText);

        if (flagged) {
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
                return res.json({ success: true });
            });
        } else {
            return res.json({ success: true });
        }
    });
};

exports.getContent = (req, res) => {
    const contentID = req.params.id;

    // ✅ SORT LOGIC MUST LIVE HERE
    const sort = req.query.sort || "newest";

    let orderBy = "e.createdAt DESC"; // default

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

    db.query(contentSql, [contentID], (err, contentRows) => {
        if (err) return res.status(500).send("Error loading content");

        if (contentRows.length === 0) {
            return res.status(404).send("Content not found");
        }

        const content = contentRows[0];

        const viewerUserID = req.session.user ? req.session.user.userID : 0;
        const viewerRole = req.session.user ? req.session.user.userType : 'User';

        console.log("👀 Viewer:", {
            viewerUserID,
            viewerRole
        });

        db.query(
            commentSql,
            [contentID, viewerUserID, viewerRole],
            (err2, comments) => {
                if (err2) { 
                    console.log("🔥 COMMENT SQL ERROR:", err2);
                    return res.status(500).send("Error loading comments");
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

// ======================================
// BLOCKED COMMENT - ADMIN ONLY
// ======================================
exports.blockComment = (req, res) => {
  const commentID = req.params.id;
  const contentID = req.body.contentID;
  const userType = req.session.user.userType;

  if (!['Admin'].includes(userType)) {
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

// ======================================
// UNBLOCK COMMENT - ADMIN ONLY
// ======================================
exports.unblockComment = (req, res) => {
  const commentID = req.params.commentID;
  const userType = req.session.user.userType;
  const contentID = req.body.contentID; // 👈 IMPORTANT

  if (!['Admin'].includes(userType)) {
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

    // ✅ Redirect properly
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
            res.redirect(`/content/${contentID}?success=edited`);
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

const getAllCategories = (db, callback) => {
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
    // First, get the categoryID of the content
    const getCategorySql = 'SELECT contentTypeID FROM content WHERE contentID = ?';
    db.query(getCategorySql, [contentID], (getError, getResults) => {
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