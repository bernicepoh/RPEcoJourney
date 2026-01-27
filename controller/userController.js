const db = require('../db');
const nodemailer = require('nodemailer');
 
exports.getLogin = (req,res) => {
  res.render('index', {
      messages: req.flash('success'),
      errors: req.flash('error'),
      user: req.session.user
  });
};
 
exports.login = (req, res) => {
  const { userName, password } = req.body;
 
  if (!userName || !password) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/');
  }
 
  const sql = `
    SELECT *
    FROM "user"
    WHERE username = $1
    AND password = encode(digest($2, 'sha256'), 'hex')
  `;
 
  db.query(sql, [userName, password], (err, results) => {
    if (err) {
      console.error('Error during login:', err);
      req.flash('error', 'An error occurred. Please try again.');
      return res.redirect('/');
    }
 
    if (results.rows.length > 0) {
      const user = results.rows[0];
      req.session.user = user;
      req.flash('loginSuccess', 'Login successful');
 
      const initProgress = `
        INSERT INTO "user" (userID, totalXP, level, streak, CheckInDate)
        VALUES ($1, 0, 1, 0, NULL)
        ON CONFLICT ("userID") DO NOTHING
      `;
      db.query(initProgress, [user.userID]);
 
      if (user.userType === 'User') {
        res.redirect('/homepage');
      } else {
        res.redirect('/adminDashboard');
      }
 
    } else {
      req.flash('error', 'Invalid username or password');
      res.redirect('/');
    }
  });
};
 
exports.getRegister = (req, res) => {
  const errors = req.flash('error');
  const messages = req.flash('success');
  const formData = req.flash('formData')[0] || {};
 
  res.render('register', {
    errors,
    messages,
    formData,
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
 
  db.query(`SELECT * FROM "user" WHERE email = $1`, [email], (err, results) => {
    if (err) throw err;
 
    if (results.rows.length === 0) {
      req.flash('error', 'Email not found.');
      return res.redirect('/forgot-password');
    }
 
    const tempPassword = generateTempPassword(8);
 
    db.query(
      `UPDATE "user"
       SET password = encode(digest($1, 'sha256'), 'hex')
       WHERE email = $2`,
      [tempPassword, email],
      (err) => {
        if (err) throw err;
 
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
          subject: 'OTP',
          text: `Your One-time password is: ${tempPassword}\nPlease use this to log in and reset your password.`
        };
 
        transporter.sendMail(mailOptions, (error) => {
          if (error) {
            req.flash('error', 'Error sending email.');
            return res.redirect('/forgot-password');
          }
 
          res.render('forgot_password', { 
            step: 2,
            email,
            errors: [],
            success: ['Temporary password sent to your email.']
          });
        });
      }
    );
  });
};
 
exports.postResetPassword = (req, res) => {
  const { email, tempPassword, newPassword, confirmPassword } = req.body;
  const errors = [];
 
  if (!email || !tempPassword || !newPassword || !confirmPassword) {
    errors.push('All fields are required.');
  }
 
  const sql = `
    SELECT *
    FROM "user"
    WHERE email = $1
    AND password = encode(digest($2, 'sha256'), 'hex')
  `;
 
  db.query(sql, [email, tempPassword], (err, results) => {
    if (err) throw err;
 
    if (results.rows.length === 0) {
      return res.render('forgot_password', {
        step: 2,
        email,
        errors: ['Temporary password is incorrect.'],
        success: [],
      });
    }
 
    db.query(
      `UPDATE "user"
       SET password = encode(digest($1, 'sha256'), 'hex')
       WHERE email = $2`,
      [newPassword, email],
      (err) => {
        if (err) throw err;
 
        req.flash('success', 'Password successfully reset. You can now log in.');
        res.redirect('/');
      }
    );
  });
};
 
exports.register = (req, res) => {
  const { userName, email, password, confirmPassword, contactNo } = req.body;
  const errors = [];
 
  if (errors.length > 0) {
    req.flash('error', errors);
    req.flash('formData', req.body);
    return res.redirect('/register');
  }
 
  db.query(`SELECT * FROM "user" WHERE email = $1`, [email], (err, result) => {
    if (result.rows.length > 0) {
      req.flash('error', 'Email is already in use.');
      return res.redirect('/register');
    }
 
    db.query(
      `INSERT INTO "user" (username, email, password, contactNo)
       VALUES ($1, $2, encode(digest($3, 'sha256'), 'hex'), $4)`,
      [userName, email, password, contactNo],
      (err) => {
        if (err) throw err;
 
        req.flash('success', 'Registration successful. You can now log in.');
        res.redirect('/');
      }
    );
  });
};
 
exports.getAdminDashboard = (req,res) => {
  const username = req.session.user ? req.session.user.userName : 'Guest';
  const role = req.session.user ? req.session.user.userType : null;
 
  res.render('adminDashboard', {
    user: req.session.user,
    userName: username,
    userType: role,
    loginSuccess: req.flash("loginSuccess")
  });
};
 
exports.getAllUsers = (req, res) => {
  db.query(`SELECT * FROM "user"`, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).send('Error Retrieving users');
    }
 
    res.render('adminUsers', {
      users: results.rows,
      user: req.session.user
    });
  });
};