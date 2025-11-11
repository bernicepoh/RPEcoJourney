const db = require('../db');
const nodemailer = require('nodemailer');

exports.getLogin = (req,res) => {
  res.render('index', {
      messages: req.flash('success'),
      errors: req.flash('error'),
      user: req.session.user
  });
};

exports.login = (req,res) => {
  const { userName, password} = req.body;

  if (!userName || !password) {
    req.flash('error','All fields are required.');
    return res.redirect('/')
  }

  const sql = 'SELECT * FROM users WHERE userName = ? AND password = SHA(?)'
  db.query(sql, [userName,password], (err, results) => {
    if (err) {
      console.error('Error during login:', err);
      req.flash('error','An error occured. Please try again');
      return res.redirect('/')
    }

    if (results.length > 0) {
      req.session.user = results[0];
      req.flash('success','Login successful');
      res.redirect('/homepage')
    } else {
      req.flash('error','Invalid email or password');
      res.redirect('/');
    }
  }
  );


};

exports.getRegister = (req, res) => {
  res.render('register', { 
    errors: req.flash('error'),       
    messages: req.flash('success'),   
    formData: req.flash('formData')[0] || {},
    user: req.session.user
  });
};


exports.getForgotPassword = (req, res) => {
    res.render('forgot_password', { 
        step: 1,              
        email: '',             
        errors: req.flash('error'), 
        success: req.flash('success') 
    });
};

function generateTempPassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

exports.postForgotPassword = (req, res) => {
    const { email } = req.body;

    if (!email) {
        req.flash('error', 'Please enter your email.');
        return res.redirect('/forgot-password');
    }

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            req.flash('error', 'Email not found.');
            return res.redirect('/forgot-password');
        }

        const tempPassword = generateTempPassword(8);

        
        db.query('UPDATE users SET password = SHA(?) WHERE email = ?', [tempPassword, email], (err) => {
            if (err) throw err;

            // Configure mail
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'fyptesting13@gmail.com',
                    pass: 'fjbjltcfxfofwiho' 
                }
            });

            const mailOptions = {
                from: 'fyptesting13@gmail.com',
                to: email,
                subject: 'Temporary Password',
                text: `Your temporary password is: ${tempPassword}\nPlease use this to log in and reset your password.`
            };

            // Send email
            transporter.sendMail(mailOptions, (error) => {
                if (error) {
                    console.log(error);
                    req.flash('error', 'Error sending email.');
                    return res.redirect('/forgot-password');
                }

                // Render page showing step 2
                res.render('forgot_password', { 
                    step: 2,
                    email: email,
                    errors: [],
                    success: ['Temporary password sent to your email.']
                });
            });
        });
    });
};

exports.postResetPassword = (req, res) => {
    const { email, tempPassword, newPassword } = req.body;

    if (!email || !tempPassword || !newPassword) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/forgot-password');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA(?)';
    db.query(sql, [email, tempPassword], (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            // Temporary password incorrect
            return res.render('forgot_password', { 
                step: 2, 
                email, 
                errors: ['Temporary password is incorrect.'], 
                success: [] 
            });
        }

        // Update password with new password
        db.query('UPDATE users SET password = SHA(?) WHERE email = ?', [newPassword, email], (err) => {
            if (err) throw err;

            req.flash('success', 'Password successfully reset. You can now log in.');
            res.redirect('/');
        });
    });
};

exports.register = (req, res) => {
  const { userName, email, password, contactNo } = req.body;

  
  const checkEmailSql = 'SELECT * FROM users WHERE email = ?';
  db.query(checkEmailSql, [email], (err, results) => {
    if (err) {
      console.error('Error checking email:', err);
      req.flash('error', 'An error occurred. Please try again.');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    if (results.length > 0) {
      req.flash('error', 'Email is already in use');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    
    const checkContactSql = 'SELECT * FROM users WHERE contactNo = ?';
    db.query(checkContactSql, [contactNo], (err, results) => {
      if (err) {
        console.error('Error checking contact number:', err);
        req.flash('error', 'An error occurred. Please try again.');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }

      if (results.length > 0) {
        req.flash('error', 'Contact number is already in use');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }

      
      const insertSql = 'INSERT INTO users (userName, email, password, contactNo) VALUES (?, ?, SHA(?), ?)';
      db.query(insertSql, [userName, email, password, contactNo], (err, results) => {
        if (err) {
          console.error('Error registering user:', err);
          req.flash('error', 'An error occurred while registering. Please try again.');
          req.flash('formData', req.body);
          return res.redirect('/register');
        }

        req.flash('success', 'Registration successful. You can now log in.');
        res.redirect('/');
      });
    });
  });
};