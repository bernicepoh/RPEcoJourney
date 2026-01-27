const db = require('../db');
const fs = require('fs');
const path = require('path');

// Public — List all categories
exports.getCategories = (req, res) => {
    const sql = 'SELECT * FROM content_type';

    db.query(sql, (error, result) => {
        if (error) {
            console.error('Database query error:', error.message);

            return res.render("categories", {
                categories: [],
                user: req.session.user,
                flashSuccess: req.flash("success"),
                flashError: req.flash("error")
            });
        }

        const results = result.rows || result;

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
    const contentTypeID = req.params.id;
    console.log("🟢 PARAM ID:", contentTypeID);

    const sql = 'SELECT * FROM content_type WHERE contentTypeID = $1';

    db.query(sql, [contentTypeID], (error, result) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving category by ID');
        }

        const results = result.rows || result;

        if (results.length > 0) {
            res.render('category', { 
                category: results[0],
                user: req.session.user || null  
            });
        } else {
            res.status(404).send('Category not found');
        }
    });
};

// ADMIN / MANAGER

// Admin/Manager Manage Categories Page
exports.getManageCategories = (req, res) => {
    const sql = 'SELECT * FROM content_type';

    db.query(sql, (err, result) => {
        if (err) {
            console.error("Category query error:", err);
            return res.status(500).send("Database error");
        }

        const results = result.rows || result;

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

// Admin/Manager — Add new category
exports.addCategory = (req, res) => {
    const { contentTypeName, contentTypeDescription } = req.body;
    let contentTypeImage = req.file ? req.file.filename : null;

    const sql = `
        INSERT INTO content_type 
        (contentTypeName, contentTypeDescription, contentTypeImage) 
        VALUES ($1, $2, $3)
    `;
    
    db.query(sql, [contentTypeName, contentTypeDescription, contentTypeImage], (error) => {
        if (error) {
            console.error("FULL POSTGRES ERROR:", error);
            return res.status(500).send(error.message || "Error adding category");
        }

        req.flash('success', 'Category added successfully!');
        res.redirect('/manageCategories');
    });
};

// Admin/Manager — Render Edit Category Form
exports.editCategoryForm = (req, res) => {
    const contentTypeID = req.params.id;
    const sql = 'SELECT * FROM content_type WHERE contentTypeID = $1';
    
    db.query(sql, [contentTypeID], (error, result) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving category');
        }

        const results = result.rows || result;

        if (results.length > 0) {
            console.log("CATEGORY OBJECT:", results[0]);
            res.render('editCategory', { 
                category: results[0],
                user: req.session.user
            });
        } else {
            res.status(404).send('Category not found');
        }
    });
};

// Admin/Manager — Update existing category
exports.updateCategory = (req, res) => {
    const contentID = req.params.id;
    const { contentName, contentDescription } = req.body;
    let contentTypeImage = req.body.currentImage;

    if (req.file) {
        contentTypeImage = req.file.filename;
    }

    const sql = `
        UPDATE content_type 
        SET contentName = $1, contentDescription = $2, contentTypeImage = $3 
        WHERE contentID = $4
    `;
    
    db.query(sql, [contentName, contentDescription, contentTypeImage, contentID], (error) => {
        if (error) {
            console.error('Error updating category:', error.message);
            return res.status(500).send('Error updating category');
        }

        req.flash('success', 'Category updated successfully!');
        res.redirect('/manageCategories');
    });
};

// Admin/Manager — Delete Category (Enhanced)
exports.deleteCategory = (req, res) => {
    const contentTypeID = req.params.id;

    if (!contentTypeID) {
        req.flash('error', 'Invalid category ID');
        return res.redirect('/manageCategories');
    }

    // 1️⃣ Check if category has content
    const contentSql = 'SELECT * FROM content WHERE contentTypeID = $1';
    db.query(contentSql, [contentTypeID], (err, contentResult) => {
        if (err) {
            console.error('Content check error:', err.message);
            req.flash('error', 'Server error');
            return res.redirect('/manageCategories');
        }

        const contentResults = contentResult.rows || contentResult;

        if (contentResults.length > 0) {
            req.flash('error', 'Unable to delete — category contains content.');
            return res.redirect('/manageCategories');
        }

        // 2️⃣ Get category image BEFORE deletion
        const getCategorySql = 'SELECT contentTypeImage FROM content_type WHERE contentTypeID = $1';
        db.query(getCategorySql, [contentTypeID], (err, imageResult) => {
            if (err) {
                console.error('Image lookup error:', err.message);
                req.flash('error', 'Server error');
                return res.redirect('/manageCategories');
            }

            const imageResults = imageResult.rows || imageResult;
            const imageFile = imageResults[0]?.contentTypeImage;

            // 3️⃣ Delete category from DB
            const deleteSql = 'DELETE FROM content_type WHERE contentTypeID = $1';
            db.query(deleteSql, [contentTypeID], (err) => {
                if (err) {
                    console.error('Delete error:', err.message);
                    req.flash('error', 'Server error');
                    return res.redirect('/manageCategories');
                }

                // 4️⃣ Delete image if needed
                if (imageFile && imageFile !== 'default.png') {
                    const uploadPath = path.join(__dirname, '../public/uploads', imageFile);
                    const imagesPath = path.join(__dirname, '../public/images', imageFile);

                    const finalPath =
                        fs.existsSync(uploadPath) ? uploadPath :
                        fs.existsSync(imagesPath) ? imagesPath :
                        null;

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