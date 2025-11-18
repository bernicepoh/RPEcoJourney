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

  const sql = 'SELECT * FROM user WHERE userName = ? AND password = SHA(?)';
  db.query(sql, [userName, password], (err, results) => {
    if (err) {
      console.error('Error during login:', err);
      req.flash('error', 'An error occurred. Please try again.');
      return res.redirect('/');
    }

    if (results.length > 0) {
      const user = results[0];
      req.session.user = user;
      req.flash('success', 'Login successful');

      
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

    db.query('SELECT * FROM user WHERE email = ?', [email], (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            req.flash('error', 'Email not found.');
            return res.redirect('/forgot-password');
        }

        const tempPassword = generateTempPassword(8);

        
        db.query('UPDATE user SET password = SHA(?) WHERE email = ?', [tempPassword, email], (err) => {
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
  const { email, tempPassword, newPassword, confirmPassword } = req.body;
  const errors = [];
 
 
  if (!email || !tempPassword || !newPassword || !confirmPassword) {
    errors.push('All fields are required.');
  }
 
 
  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid Gmail address (example@gmail.com).');
  }
 
 
  const passwordRegex =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    errors.push(
      'New password must be at least 8 characters long and include one uppercase letter, one number, and one special character.'
    );
  }
 
 
  if (newPassword !== confirmPassword) {
    errors.push('Passwords do not match.');
  }
 
 
  if (errors.length > 0) {
    return res.render('forgot_password', {
      step: 2,
      email,
      errors,
      success: [],
    });
  }
 
 
  const sql = 'SELECT * FROM user WHERE email = ? AND password = SHA(?)';
  db.query(sql, [email, tempPassword], (err, results) => {
    if (err) throw err;
 
    if (results.length === 0) {
      return res.render('forgot_password', {
        step: 2,
        email,
        errors: ['Temporary password is incorrect.'],
        success: [],
      });
    }
 
   
    db.query('UPDATE user SET password = SHA(?) WHERE email = ?', [newPassword, email], (err) => {
      if (err) throw err;
 
      req.flash('success', 'Password successfully reset. You can now log in.');
      res.redirect('/');
    });
  });
};

exports.register = (req, res) => {
  const { userName, email, password, confirmPassword, contactNo } = req.body;
  const errors = [];
 
 
  if (!userName || !email || !password || !confirmPassword || !contactNo) {
    errors.push('All fields are required.');
  }
 
 
  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid Gmail address (example@gmail.com).');
  }
 
 
  const passwordRegex =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{8,}$/;
  if (!passwordRegex.test(password)) {
    errors.push(
      'Password must be at least 8 characters long and include one uppercase letter, one number, and one special character.'
    );
  }
 
 
  if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }
 
 
  const contactRegex = /^[0-9]{8}$/;
  if (!contactRegex.test(contactNo)) {
    errors.push('Please enter a valid 8-digit contact number.');
  }
 
 
  if (errors.length > 0) {
    req.flash('error', errors);
    req.flash('formData', req.body);
    return res.redirect('/register');
  }
 
  const checkEmailSql = 'SELECT * FROM user WHERE email = ?';
  db.query(checkEmailSql, [email], (err, results) => {
    if (err) {
      console.error('Error checking email:', err);
      req.flash('error', 'An error occurred. Please try again.');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }
 
    if (results.length > 0) {
      req.flash('error', 'Email is already in use.');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }
 
   
    const checkContactSql = 'SELECT * FROM user WHERE contactNo = ?';
    db.query(checkContactSql, [contactNo], (err, results) => {
      if (err) {
        console.error('Error checking contact number:', err);
        req.flash('error', 'An error occurred. Please try again.');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }
 
      if (results.length > 0) {
        req.flash('error', 'Contact number is already in use.');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }
 
     
      const insertSql =
        'INSERT INTO user (userName, email, password, contactNo) VALUES (?, ?, SHA(?), ?)';
      db.query(insertSql, [userName, email, password, contactNo], (err) => {
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


exports.getAdminDashboard = (req,res) => {

  const username = req.session.user ? req.session.user.userName : 'Guest'; 
  const user = req.session.user 

  

  res.render('adminDashboard', {
    user: req.session.user,
    userName: username,
    user

  })
  
  

};

exports.getAllUsers = (req, res) => {
  const sql = 'SELECT * FROM user';
  const user = req.session.user 

  db.query(sql,   (error, results) => {

       if (error) {
            console.error('Database Query Error', error.message);
            return res.status(500).send('Error Retrieving users');
        }

        res.render('adminUsers', {
            users: results,
            user
        });
    });


};