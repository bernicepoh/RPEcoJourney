const db = require('../db');
const nodemailer = require('nodemailer');

exports.getLogin = (req, res) => {
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
    WHERE "userName" = $1
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

      // Auto create progress row if missing
      const initProgress = `
        INSERT INTO user_progress (userID, totalXP, level, streak, "CheckInDate")
        VALUES ($1, 0, 1, 0, NULL)
        ON CONFLICT (userID) DO NOTHING
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

  db.query(
    'SELECT * FROM "user" WHERE email = $1',
    [email],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.redirect('/forgot-password');
      }

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
          if (err) {
            console.error(err);
            return res.redirect('/forgot-password');
          }

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
            text: `Your One-time password is: ${tempPassword}`
          };

          transporter.sendMail(mailOptions, (error) => {
            if (error) {
              console.log(error);
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
    }
  );
};

exports.postResetPassword = (req, res) => {
  const { email, tempPassword, newPassword, confirmPassword } = req.body;
  const errors = [];

  if (!email || !tempPassword || !newPassword || !confirmPassword) {
    errors.push('All fields are required.');
  }

  if (newPassword !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  if (errors.length > 0) {
    return res.render('forgot_password', {
      step: 2,
      email,
      errors,
      success: []
    });
  }

  const sql = `
    SELECT *
    FROM "user"
    WHERE email = $1
      AND password = encode(digest($2, 'sha256'), 'hex')
  `;

  db.query(sql, [email, tempPassword], (err, results) => {
    if (err || results.rows.length === 0) {
      return res.render('forgot_password', {
        step: 2,
        email,
        errors: ['Temporary password is incorrect.'],
        success: []
      });
    }

    db.query(
      `UPDATE "user"
       SET password = encode(digest($1, 'sha256'), 'hex')
       WHERE email = $2`,
      [newPassword, email],
      () => {
        req.flash('success', 'Password successfully reset.');
        res.redirect('/');
      }
    );
  });
};

exports.register = (req, res) => {
  const { userName, email, password, confirmPassword, contactNo } = req.body;
  const errors = [];

  if (!userName || !email || !password || !confirmPassword || !contactNo) {
    errors.push('All fields are required.');
  }

  if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  if (errors.length > 0) {
    req.flash('error', errors);
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  db.query(
    'SELECT * FROM "user" WHERE email = $1',
    [email],
    (err, results) => {
      if (results.rows.length > 0) {
        req.flash('error', 'Email already exists.');
        return res.redirect('/register');
      }

      const insertSql = `
        INSERT INTO "user" (userName, email, password, contactNo)
        VALUES ($1, $2, encode(digest($3, 'sha256'), 'hex'), $4)
      `;

      db.query(insertSql, [userName, email, password, contactNo], () => {
        req.flash('success', 'Registration successful.');
        res.redirect('/');
      });
    }
  );
};

exports.getAdminDashboard = (req, res) => {
  res.render('adminDashboard', {
    user: req.session.user,
    userName: req.session.user?.userName,
    userType: req.session.user?.userType,
    loginSuccess: req.flash('loginSuccess')
  });
};

exports.getAllUsers = (req, res) => {
  const user = req.session.user;
  const { email, contactNo } = req.query;

  if (email && contactNo) {
    db.query(
      'SELECT * FROM "user" WHERE email = $1 AND contactNo = $2',
      [email.trim(), contactNo.trim()],
      (err, results) => {
        res.render('adminUsers', {
          users: results.rows,
          user,
          error: results.rows.length ? null : 'No user found.',
          success: [],
          searchEmail: email,
          searchContactNo: contactNo
        });
      }
    );
  } else {
    db.query('SELECT * FROM "user"', (err, results) => {
      res.render('adminUsers', {
        users: results.rows,
        user,
        error: null,
        success: req.flash('success'),
        searchEmail: '',
        searchContactNo: ''
      });
    });
  }
};