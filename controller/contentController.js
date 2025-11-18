const db = require('../db');
const nodemailer = require('nodemailer');

// ============================
// GET CONTENT BY CATEGORY
// ============================
exports.getContentByCategory = (req, res) => {
    const categoryID = req.params.id;
    const sql = `SELECT 
                    c.contentID, 
                    c.contentTitle, 
                    c.contentDescription, 
                    c.contentFile,
                    cat.categoryName,
                    cat.categoryDescription,
                    cat.categoryImage
                FROM 
                    content c
                JOIN 
                    category cat
                ON 
                    c.categoryID = cat.categoryID
                WHERE 
                    cat.categoryID = ?;`;

    db.query(sql, [categoryID], (error, results) => {
        if (error) {
            return res.status(500).send('Error retrieving content');
        }
        if (results.length > 0) {
            // Use data from first item for category info
            const categoryInfo = {
                categoryName: results[0].categoryName,
                categoryDescription: results[0].categoryDescription,
                categoryImage: results[0].categoryImage
            };
            res.render('viewContentByCategory', {
                category: categoryInfo,
                contentList: results,
                user: req.session.user || null
            });
        } else {
            // No content, but still try to get category info for banner, etc.
            const catSql = 'SELECT * FROM category WHERE categoryID = ?';
            db.query(catSql, [categoryID], (catError, catRows) => {
                if (catError || catRows.length === 0) {
                    return res.status(404).send('Category not found');
                }
                const categoryInfo = {
                    categoryName: catRows[0].categoryName,
                    categoryDescription: catRows[0].categoryDescription,
                    categoryImage: catRows[0].categoryImage
                };
                res.render('viewContentByCategory', {
                    category: categoryInfo,
                    contentList: [],
                    user: req.session.user || null
                });
            });
        }
    });
};

// ============================
// TOGGLE LIKE
// ============================
exports.toggleLike = (req, res) => {
    if (!req.session.user) {
        // Not logged in
        return res.status(401).json({ success: false, notLoggedIn: true });
    }

    const userID = req.session.user.userID;
    const contentID = req.params.contentID;

    // 1) Check if user already liked this content
    const checkSql = 'SELECT engagementID FROM engagement WHERE userID = ? AND contentID = ?';

    db.query(checkSql, [userID, contentID], (err, rows) => {
        if (err) {
            console.error('Error checking like:', err);
            return res.status(500).json({ success: false });
        }

        if (rows.length > 0) {
            // Already liked → UNLIKE (delete row)
            const deleteSql = 'DELETE FROM engagement WHERE userID = ? AND contentID = ?';
            db.query(deleteSql, [userID, contentID], (delErr) => {
                if (delErr) {
                    console.error('Error deleting like:', delErr);
                    return res.status(500).json({ success: false });
                }

                // Get updated like count
                const countSql = 'SELECT COUNT(*) AS likeCount FROM engagement WHERE contentID = ?';
                db.query(countSql, [contentID], (countErr, countRows) => {
                    if (countErr) {
                        console.error('Error counting likes:', countErr);
                        return res.status(500).json({ success: false });
                    }

                    return res.json({
                        success: true,
                        liked: false,
                        likeCount: countRows[0].likeCount
                    });
                });
            });

        } else {
            // Not liked yet → LIKE (insert row)
            const insertSql = 'INSERT INTO engagement (userID, contentID) VALUES (?, ?)';
            db.query(insertSql, [userID, contentID], (insErr) => {
                if (insErr) {
                    console.error('Error inserting like:', insErr);
                    return res.status(500).json({ success: false });
                }

                // Get updated like count
                const countSql = 'SELECT COUNT(*) AS likeCount FROM engagement WHERE contentID = ?';
                db.query(countSql, [contentID], (countErr, countRows) => {
                    if (countErr) {
                        console.error('Error counting likes:', countErr);
                        return res.status(500).json({ success: false });
                    }

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

// ============================
// POSTING OF COMMENT 
// ============================
exports.postComment = (req, res) => {
    const contentID = req.params.id;
    const userID = req.session.user.userID;  // user must be logged in
    const commentText = req.body.commentText;

    const sql = `
        INSERT INTO engagement (userID, contentID, comments, share) 
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [userID, contentID, commentText, 0], (err) => {
        if (err) {
            console.error("Error inserting comment:", err);
            return res.status(500).send("Failed to post comment");
        }

        // Redirect back to same content page
        res.redirect(`/content/${contentID}`);
    });
};

exports.getContent = (req, res) => {
    const contentID = req.params.id;
    const sql = 'SELECT * FROM content c JOIN category cat ON c.categoryID = cat.categoryID WHERE contentID = ?';
    // Fetch data from MySQL
    db.query(sql, [contentID], (error, results) => {

        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving category by ID');
        }

        // Check if any content with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the category data
            res.render('viewContent', { content: results[0] });
        } else {
            // If no product with the given ID was found, 
            //render a 404 page or handle it accordingly
            res.status(404).send('Content not found');
        }
    });
};

exports.editComment = (req, res) => {
    const commentID = req.params.commentID;
    const userID = req.session.user.userID;
    const { updatedText } = req.body;

    if (!updatedText || updatedText.trim() === "") {
        return res.redirect('back'); 
    }

    // Step 1: Get the related contentID first
    const getContentSQL = "SELECT contentID FROM comments WHERE commentID = ? AND userID = ?";

    db.query(getContentSQL, [commentID, userID], (err, result) => {
        if (err || result.length === 0) {
            return res.redirect('back');
        }

        const contentID = result[0].contentID;

        // Step 2: Update comment
        const updateSQL = `
            UPDATE engagement SET comments = ?
            WHERE engagementID = ? AND userID = ?
        `;

        db.query(updateSQL, [updatedText.trim(), commentID, userID], (err) => {
            if (err) return res.status(500).send('Failed to edit comment');
            
            // Step 3: Redirect back to main post page
            res.redirect(`/content/${contentID}`);
        });
    });
};

exports.deleteComment = (req, res) => {
    const commentID = req.params.commentID;
    const userID = req.session.user.userID;

    const sqlGet = `SELECT engagementID FROM engagement WHERE engagementID = ? AND userID = ?`;

    db.query(sqlGet, [commentID, userID], (err, result) => {
        if (err || result.length === 0) return res.redirect('back');

        const contentID = result[0].contentID;

        const sqlDelete = `DELETE FROM engagement WHERE engagementID = ? AND userID = ?`;

        db.query(sqlDelete, [commentID, userID], (err) => {
            if (err) return res.status(500).send('Failed to delete comment');
            res.redirect(`/content/${contentID}`);
        });
    });
};


exports.addContentForm = (req, res) => {
    const sql = 'SELECT * FROM category';
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
    const { categoryID, contentTitle, contentDescription } = req.body;
    let contentFile;
    if (req.file) {
        contentFile = req.file.filename; // Save only the filename
    } else {
        contentFile = null;
    }

    const sql = 'INSERT INTO content (categoryID, contentTitle, contentDescription, contentFile) VALUES (?, ?, ?, ?)';
   

    // Insert the new content into the database
    db.query(sql, [categoryID, contentTitle, contentDescription, contentFile], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding content:", error);
            res.status(500).send('Error adding content');
        } else {
            // Send a success response
            res.redirect(`/content/${results.insertId}`);
        }
    });
};

const getAllCategories = (db, callback) => {
    const sql = 'SELECT * FROM category';

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
    const { categoryID, contentTitle, contentDescription } = req.body;
    let contentFile = req.body.currentFile; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        contentFile = req.file.filename; // set image to be new image filename
    }
    console.log("new file: " + contentFile);
    const sql = 'UPDATE content SET categoryID = ?, contentTitle = ?, contentDescription = ?, contentFile = ? WHERE contentID = ?';

    // Updated the content into the database
    db.query(sql, [categoryID, contentTitle, contentDescription, contentFile, contentID], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error updating content:", error);
            res.status(500).send('Error updating content');
        } else {
            // Send a success response
            res.redirect(`/category/${categoryID}/content`);

        }
    });
};

exports.deleteContent = (req, res) => {
    const contentID = req.params.id;
    // First, get the categoryID of the content
    const getCategorySql = 'SELECT categoryID FROM content WHERE contentID = ?';
    db.query(getCategorySql, [contentID], (getError, getResults) => {
        if (getError) {
            console.error("Error fetching categoryID:", getError);
            return res.status(500).send('Error deleting content');
        }
        if (getResults.length === 0) {
            return res.status(404).send('Content not found');
        }
        const categoryID = getResults[0].categoryID;
        // Now delete the content
        const deleteSql = 'DELETE FROM content WHERE contentID = ?';
        db.query(deleteSql, [contentID], (deleteError, deleteResults) => {
            if (deleteError) {
                console.error("Error deleting content:", deleteError);
                return res.status(500).send('Error deleting content');
            } else {
                // Redirect to viewContentByCategory for the category
                res.redirect(`/category/${categoryID}/content`);
            }
        });
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