const db = require('../db');
const fs = require('fs');
const path = require('path');
const { translateText } = require('../middleware/translator');

// Public — List all categories
exports.getCategories = async (req, res) => {
    const sql = 'SELECT * FROM content_type';
    const user = req.session.user;
    const currentLang = req.session.language || req.cookies.language || 'en';

    // Fetch data from MySQL
    db.query(sql, async (error, results) => {
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
        // Filter out Uncategorized before translation
        results = results.filter(cat => cat.contentTypeName !== 'Uncategorized');
        
        console.log('🔍 Categories before translation:', results.map(c => c.contentTypeName));
        console.log('🌐 Current language:', currentLang);
        
        // Translate category names and descriptions if not English
        if (currentLang !== 'en' && results.length > 0) {
            console.log('🔄 Starting translation to:', currentLang);
            for (let category of results) {
                const origName = category.contentTypeName;
                
                category.contentTypeName = await translateText(category.contentTypeName, currentLang);
                if (category.contentTypeDescription) {
                    category.contentTypeDescription = await translateText(category.contentTypeDescription, currentLang);
                }
                
                console.log(`✅ Translated: ${origName} → ${category.contentTypeName}`);
            }
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
    const contentTypeID = req.params.id;
     console.log("🟢 PARAM ID:", contentTypeID);
    const sql = 'SELECT * FROM content_type WHERE contentTypeID = ?';
    const user = req.session.user 
    
    // Fetch data from MySQL
    db.query(sql, [contentTypeID], (error, results) => {
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
    const sql = "SELECT * FROM content_type";

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
    const { contentTypeName, contentTypeDescription } = req.body;
    let contentTypeImage;
    if (req.file) {
        contentTypeImage = req.file.filename; 
    } else {
        contentTypeImage = null;
    }

    const sql = 'INSERT INTO content_type (contentTypeName, contentTypeDescription, contentTypeImage) VALUES (?, ?, ?)';
    
    // Insert the new category into the database
    db.query(sql, [contentTypeName, contentTypeDescription, contentTypeImage], (error, results) => {
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
    const contentTypeID = req.params.id;
    const sql = 'SELECT * FROM content_type WHERE contentTypeID = ?';
    //const category = db.Category.findByPk(categoryId);
    
    db.query(sql, [contentID], (error, results) => {
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
    const contentID = req.params.id;
    const { contentName, contentDescription } = req.body;
    let contentTypeImage = req.body.currentImage; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        contentTypeImage = req.file.filename; // set image to be new image filename
    }
    
    console.log("new file: " + contentTypeImage);
    
    const sql = 'UPDATE content_type SET contentName = ?, contentDescription = ?, contentTypeImage = ? WHERE contentID = ?';
    
    // Insert the new category into the database
    db.query(sql, [contentName, contentDescription, contentTypeImage, contentID], (error, results) => {
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
    const contentTypeID = req.params.id;

    if (!contentTypeID) {
        req.flash('error', 'Invalid category ID');
        return res.redirect('/manageCategories');
    }

    // 1️⃣ Check if category has content
    const contentSql = 'SELECT * FROM content WHERE contentTypeID = ?';
    db.query(contentSql, [contentTypeID], (err, contentResults) => {
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
        const getCategorySql = 'SELECT contentTypeImage FROM content_type WHERE contentTypeID = ?';
        db.query(getCategorySql, [contentTypeID], (err, imageResults) => {
            if (err) {
                console.error('Image lookup error:', err.message);
                req.flash('error', 'Server error');
                return res.redirect('/manageCategories');
            }

            const imageFile = imageResults[0]?.contentTypeImage;
            const imagePath = path.join(__dirname, '../public/uploads', imageFile);

            // 3️⃣ Delete category from DB
            const deleteSql = 'DELETE FROM content_type WHERE contentTypeID = ?';
            db.query(deleteSql, [contentTypeID], (err) => {
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
