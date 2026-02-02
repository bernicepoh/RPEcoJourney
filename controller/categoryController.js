const db = require('../db');
const fs = require('fs');
const path = require('path');
const { translateText } = require('../middleware/translator');


exports.getCategories = async (req, res) => {
    const sql = 'SELECT * FROM content_type';
    const user = req.session.user;
    const currentLang = req.session.language || req.cookies.language || 'en';


    db.query(sql, async (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);


            return res.render("categories", {
                categories: [],
                user: req.session.user,
                flashSuccess: req.flash("success"),
                flashError: req.flash("error")
            });
        }

        results = results.filter(cat => cat.contentTypeName !== 'Uncategorized');
        
        console.log('🔍 Categories before translation:', results.map(c => c.contentTypeName));
        console.log('🌐 Current language:', currentLang);
        
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

        res.render("categories", {
            categories: results,
            user: req.session.user || null,
            flashSuccess: req.flash("success"),
            flashError: req.flash("error")
        });
    });
};

exports.getCategory = (req, res) => {
    const contentTypeID = req.params.id;
     console.log("🟢 PARAM ID:", contentTypeID);
    const sql = 'SELECT * FROM content_type WHERE contentTypeID = ?';
    const user = req.session.user 
    
    db.query(sql, [contentTypeID], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving category by ID');
        }

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


exports.addCategoryForm = (req, res) => {
    res.render('addCategory');
};

exports.addCategory = (req, res) => {
    const { contentTypeName, contentTypeDescription } = req.body;
    let contentTypeImage;
    if (req.file) {
        contentTypeImage = req.file.filename; 
    } else {
        contentTypeImage = null;
    }

    const sql = 'INSERT INTO content_type (contentTypeName, contentTypeDescription, contentTypeImage) VALUES (?, ?, ?)';
    

    db.query(sql, [contentTypeName, contentTypeDescription, contentTypeImage], (error, results) => {
        if (error) {
            console.error("FULL MYSQL ERROR:", error);
            return res.status(500).send(error.sqlMessage || error.message || "Error adding category");

        } else {
            
            req.flash('success', 'Category added successfully!');
            res.redirect('/manageCategories');
        }
    });
};

exports.editCategoryForm = (req, res) => {
    const contentTypeID = req.params.id;
    const sql = 'SELECT * FROM content_type WHERE contentTypeID = ?';
    
    db.query(sql, [contentID], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving category');
        }

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

exports.updateCategory = (req, res) => {
    const contentID = req.params.id;
    const { contentName, contentDescription } = req.body;
    let contentTypeImage = req.body.currentImage; 
    if (req.file) { 
        contentTypeImage = req.file.filename; 
    }
    
    console.log("new file: " + contentTypeImage);
    
    const sql = 'UPDATE content_type SET contentName = ?, contentDescription = ?, contentTypeImage = ? WHERE contentID = ?';
    
    
    db.query(sql, [contentName, contentDescription, contentTypeImage, contentID], (error, results) => {
        if (error) {
            
            console.error('Error updating category:', error.message);
            return res.status(500).send('Error updating category');
        } else {
           
            req.flash('success', 'Category updated successfully!');
            res.redirect('/manageCategories');
        }
    });
};


exports.deleteCategory = (req, res) => {
    const contentTypeID = req.params.id;

    if (!contentTypeID) {
        req.flash('error', 'Invalid category ID');
        return res.redirect('/manageCategories');
    }

    const contentSql = `
        SELECT c.* FROM content c
        LEFT JOIN content_request cr ON c.contentID = cr.contentID
        WHERE c.contentTypeID = ?
        AND (cr.status = 'approved' OR cr.contentRequestID IS NULL)
    `;
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

        
        const getCategorySql = 'SELECT contentTypeImage FROM content_type WHERE contentTypeID = ?';
        db.query(getCategorySql, [contentTypeID], (err, imageResults) => {
            if (err) {
                console.error('Image lookup error:', err.message);
                req.flash('error', 'Server error');
                return res.redirect('/manageCategories');
            }

            const imageFile = imageResults[0]?.contentTypeImage;
            const imagePath = path.join(__dirname, '../public/uploads', imageFile);

            
            const deleteSql = 'DELETE FROM content_type WHERE contentTypeID = ?';
            db.query(deleteSql, [contentTypeID], (err) => {
                if (err) {
                    console.error('Delete error:', err.message);
                    req.flash('error', 'Server error');
                    return res.redirect('/manageCategories');
                }

                if (imageFile && imageFile !== 'default.png') {
m
                    const uploadPath = path.join(__dirname, '../public/uploads', imageFile);
                    const imagesPath = path.join(__dirname, '../public/images', imageFile);

                    let finalPath = null;

                    if (fs.existsSync(uploadPath)) {
                        finalPath = uploadPath;
                    }
                    else if (fs.existsSync(imagesPath)) {
                        finalPath = imagesPath;
                    }

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
