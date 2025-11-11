const db = require('../db');
const nodemailer = require('nodemailer');

exports.getContentByCategory = (req, res) => {
    const categoryID = req.params.id;
    const sql = `SELECT 
                    c.contentID, 
                    c.contentTitle, 
                    c.contentDescription, 
                    c.contentFile,
                    cat.categoryName 
                FROM 
                    content c
                JOIN 
                    category cat
                ON 
                    c.categoryID = cat.categoryID
                WHERE 
                    cat.categoryID = ?;`;
    // Fetch data from MySQL
    db.query(sql, [categoryID], (error, results) => {
        if (error) {
            return res.status(500).send('Error retrieving content');
        }

        if (results.length > 0) {
            console.log('All content:', results[0].contentName);
            res.render('viewContentByCategory', { category: results });
        } else {
            // If no product with the given ID was found, 
            //render a 404 page or handle it accordingly
            res.status(404).send('No content');
        }
    });
};

exports.getContent = (req, res) => {
    const contentID = req.params.id;
    const sql = 'SELECT * FROM content WHERE contentID = ?';
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

exports.addContentForm = (req, res) => {
    const sql = 'SELECT * FROM category';
    db.query(sql, (error, results) => {
        if (error) {
            console.error("Error fetching categories:", error);
            res.status(500).send('Error loading page');
        } else {
            // pass the categories to the EJS template
            res.render('addContent', { categories: results });
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
            res.redirect('/addContent');
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