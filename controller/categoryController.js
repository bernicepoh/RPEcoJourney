const db = require('../db');
const fs = require('fs');
const path = require('path');

// Public — List all categories
exports.getCategories = (req, res) => {
    const sql = 'SELECT * FROM category';
    const user = req.session.user 

    // Fetch data from MySQL
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);

            // Still render but with no categories
            return res.render("categories", {
                categories: [],
                user: req.session.user,
                flashSuccess: req.flash("success"),
                flashError: req.flash("error")
            });
        }

        // ALWAYS PASS FLASH HERE!!
        res.render("categories", {
            categories: results,
            user: req.session.user || null,
            flashSuccess: req.flash("success"),
            flashError: req.flash("error")
        });
    });
};

// Public — Get single category by ID
exports.getCategory = (req, res) => {
    const categoryID = req.params.id;
    const sql = 'SELECT * FROM category WHERE categoryID = ?';
    const user = req.session.user 
    
    // Fetch data from MySQL
    db.query(sql, [categoryID], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving category by ID');
        }

        // Check if any category with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the category data
            res.render('category', { 
                category: results[0],
            user: req.session.user || null  
         });
        } else {
            // If no category with the given ID was found, 
            //render a 404 page or handle it accordingly
            res.status(404).send('Category not found');
        }
    });
};

// ADMIN/ MANAGER 

// Admin/Manager Manage Categories Page
exports.getManageCategories = (req, res) => {
    const sql = "SELECT * FROM category";

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Category query error:", err);
            return res.status(500).send("Database error");
        }

        res.render("manageCategories", {
            categories: results,
            flashSuccess: req.flash("success"),
            flashError: req.flash("error")
        });
    });
};

// Admin/Manager — Render Add Category Form
exports.addCategoryForm = (req, res) => {
    res.render('addCategory');
};

// Admin/Manager — Add new category (IF NEED, but in this case no since only fixed to 3 categories)
exports.addCategory = (req, res) => {
    const { categoryName, categoryDescription } = req.body;
    let categoryImage;
    if (req.file) {
        categoryImage = req.file.filename; 
    } else {
        categoryImage = null;
    }

    const sql = 'INSERT INTO category (categoryName, categoryDescription, categoryImage) VALUES (?, ?, ?)';
    
    // Insert the new category into the database
    db.query(sql, [categoryName, categoryDescription, categoryImage], (error, results) => {
        if (error) {
            console.error("FULL MYSQL ERROR:", error);
            return res.status(500).send(error.sqlMessage || error.message || "Error adding category");

        } else {
            // Send a success response
            req.flash('success', 'Category added successfully!');
            res.redirect('/manageCategories');
        }
    });
};

// Admin/Manager — Render Edit Category Form
exports.editCategoryForm = (req, res) => {
    const categoryID = req.params.id;
    const sql = 'SELECT * FROM category WHERE categoryID = ?';
    //const category = db.Category.findByPk(categoryId);
    
    db.query(sql, [categoryID], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving category');
        }

        // Check if any category with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the category data
            console.log("CATEGORY OBJECT:", results[0]);
            res.render('editCategory', { 
                category: results[0],
                user: req.session.user
             });
        } else {
            // If no category with the given ID was found, 
            //render a 404 page or handle it accordingly
            res.status(404).send('Category not found');
        }
    });
};

// Admin/Manager — Update existing category
exports.updateCategory = (req, res) => {
    const categoryID = req.params.id;
    const { categoryName, categoryDescription } = req.body;
    let categoryImage = req.body.currentImage; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        categoryImage = req.file.filename; // set image to be new image filename
    }
    console.log("new file: " + categoryImage);
    
    const sql = 'UPDATE category SET categoryName = ?, categoryDescription = ?, categoryImage = ? WHERE categoryID = ?';
    
    // Insert the new category into the database
    db.query(sql, [categoryName, categoryDescription, categoryImage, categoryID], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error('Error updating category:', error.message);
            return res.status(500).send('Error updating category');
        } else {
            // Send a success response
            req.flash('success', 'Category updated successfully!');
            res.redirect('/manageCategories');
        }
    });
};

// Admin/Manager — Delete Category (Enhanced)
exports.deleteCategory = (req, res) => {
    const categoryID = req.params.id;

    if (!categoryID) {
        req.flash('error', 'Invalid category ID');
        return res.redirect('/manageCategories');
    }

    // 1️⃣ Check if category has content
    const contentSql = 'SELECT * FROM content WHERE categoryID = ?';
    db.query(contentSql, [categoryID], (err, contentResults) => {
        if (err) {
            console.error('Content check error:', err.message);
            req.flash('error', 'Server error');
            return res.redirect('/manageCategories');
        }

        if (contentResults.length > 0) {
            req.flash('error', 'Unable to delete — category contains content.');
            return res.redirect('/manageCategories');
        }

        // 2️⃣ Get category image BEFORE deletion
        const getCategorySql = 'SELECT categoryImage FROM category WHERE categoryID = ?';
        db.query(getCategorySql, [categoryID], (err, imageResults) => {
            if (err) {
                console.error('Image lookup error:', err.message);
                req.flash('error', 'Server error');
                return res.redirect('/manageCategories');
            }

            const imageFile = imageResults[0]?.categoryImage; // may be null

            // 3️⃣ Delete category from DB
            const deleteSql = 'DELETE FROM category WHERE categoryID = ?';
            db.query(deleteSql, [categoryID], (err) => {
                if (err) {
                    console.error('Delete error:', err.message);
                    req.flash('error', 'Server error');
                    return res.redirect('/manageCategories');
                }

                // 4️⃣ Delete image ONLY if:
                // - it exists
                // - it's not null
                // - it's not default.png
                if (imageFile && imageFile !== 'default.png') {

                    // Determine correct image location
                    const uploadPath = path.join(__dirname, '../public/uploads', imageFile);
                    const imagesPath = path.join(__dirname, '../public/images', imageFile);

                    let finalPath = null;

                    // Check if image exists in uploads folder
                    if (fs.existsSync(uploadPath)) {
                        finalPath = uploadPath;
                    }
                    // Or check images folder
                    else if (fs.existsSync(imagesPath)) {
                        finalPath = imagesPath;
                    }

                    // Delete if found
                    if (finalPath) {
                        fs.unlink(finalPath, (unlinkErr) => {
                            if (unlinkErr) {
                                console.warn("⚠ Failed to delete image:", unlinkErr.message);
                            }
                        });
                    }
                }

                req.flash('success', 'Category deleted successfully!');
                res.redirect('/manageCategories');
            });
        });
    });
};

// // Admin/Manager — Delete Category (Enhanced)
// exports.deleteCategory = (req, res) => {
//     const categoryID = req.params.id;

//     // 1️⃣ Safety Check: Validate ID
//     if (!categoryID) {
//         req.flash('error', 'Invalid category ID');
//         return res.redirect('/manageCategories');
//     }

//     // 2️⃣ Check if category contains related content before deletion
//     const contentSql = 'SELECT * FROM content WHERE categoryID = ?';
//     db.query(contentSql, [categoryID], (err, contentResults) => {
//         if (err) {
//             console.error('Content check error:', err.message);
//             req.flash('error', 'Server error');
//             return res.redirect('/manageCategories');
//         }

//         if (contentResults.length > 0) {
//             req.flash('error', 'Unable to delete — category contains content.');
//             return res.redirect('/manageCategories');
//         }

//         // 3️⃣ Get category image for deletion
//         const getCategorySql = 'SELECT categoryImage FROM category WHERE categoryID = ?';
//         db.query(getCategorySql, [categoryID], (err, imageResults) => {
//             if (err) {
//                 console.error('Image lookup error:', err.message);
//                 req.flash('error', 'Server error');
//                 return res.redirect('/manageCategories');
//             }

//             const imageFile = imageResults[0]?.categoryImage;
//             const imagePath = path.join(__dirname, '../public/images', imageFile);

//             // 4️⃣ Delete category record
//             const deleteSql = 'DELETE FROM category WHERE categoryID = ?';
//             db.query(deleteSql, [categoryID], (err) => {
//                 if (err) {
//                     console.error('Delete error:', err.message);
//                     req.flash('error', 'Server error');
//                     return res.redirect('/manageCategories');
//                 }

//                 // 5️⃣ Delete image if exists & is not null/default
//                 if (imageFile && imageFile !== 'default.png') {

//                     const imagePath = path.join(__dirname, '../public/images', imageFile);

//                     fs.unlink(imagePath, (unlinkErr) => {
//                         if (unlinkErr) {
//                             console.warn("⚠ Failed to delete image:", unlinkErr.message);
//                         }
//                     });
//                 }

//                 req.flash('success', 'Category deleted successfully!');
//                 res.redirect('/manageCategories');
//             });
//         });
//     });
// };

// // Admin/Manager — Delete Category (Enhanced & Safe)
// exports.deleteCategory = (req, res) => {
//     const categoryID = req.params.id;

//     // Safety Check: Validate ID
//     if (!categoryID) {
//         req.flash('error', 'Invalid category ID');
//         return res.redirect('/manageCategories');
//     }

//     // Check if category has content
//     const checkSql = 'SELECT contentID FROM content WHERE categoryID = ?';
//     db.query(checkSql, [categoryID], (err, contentRows) => {
//         if (err) {
//             console.error("Error checking category content:", err);
//             req.flash('error', 'Server error');
//             return res.redirect('/manageCategories');
//         }

//         // If content exists → move to Uncategorized (ID = 0)
//         if (contentRows.length > 0) {
//             const moveSql = 'UPDATE content SET categoryID = 0 WHERE categoryID = ?';

//             db.query(moveSql, [categoryID], (moveErr) => {
//                 if (moveErr) {
//                     console.error("Error moving content:", moveErr);
//                     req.flash('error', 'Could not move content before deletion.');
//                     return res.redirect('/manageCategories');
//                 }

//                 console.log(`Moved ${contentRows.length} item(s) to Uncategorized.`);
//             });
//         }

//         // Get category image
//         const imgSql = 'SELECT categoryImage FROM category WHERE categoryID = ?';
//         db.query(imgSql, [categoryID], (err, imgRows) => {
//             if (err) {
//                 console.error("Image lookup error:", err);
//                 req.flash('error', 'Server error');
//                 return res.redirect('/manageCategories');
//             }

//             const imageFile = imgRows[0]?.categoryImage || null;
//             const imagePath = path.join(__dirname, '../public/images', imageFile);

//             // Delete category itself
//             const deleteSql = 'DELETE FROM category WHERE categoryID = ?';
//             db.query(deleteSql, [categoryID], (delErr) => {
//                 if (delErr) {
//                     console.error("Delete error:", delErr);
//                     req.flash('error', 'Could not delete category.');
//                     return res.redirect('/manageCategories');
//                 }

//                 // Remove image file only if it's not default
//                 if (imageFile && imageFile !== 'default.png') {
//                     fs.unlink(imagePath, (unlinkErr) => {
//                         if (unlinkErr) {
//                             console.warn("Failed to delete image:", unlinkErr.message);
//                         }
//                     });
//                 }

//                 req.flash('success', 'Category deleted successfully!');
//                 res.redirect('/manageCategories');
//             });
//         });
//     });
// };