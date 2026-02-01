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
      req.flash('loginSuccess', 'Login successful');
      
      // ⭐ Automatically create progress row if missing
    const initProgress = `
        INSERT IGNORE INTO user (userID, totalXP, level, streak, CheckInDate)
        VALUES (?, 0, 1, 0, NULL)
    `;
    db.query(initProgress, [results[0].userID]);

      
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
  // Read flashes into variables first so we can log and ensure they are passed correctly
  const errors = req.flash('error');
  const messages = req.flash('success');
  const formData = req.flash('formData')[0] || {};

  console.log('getRegister: rendering register view with', {
    errorsCount: Array.isArray(errors) ? errors.length : 0,
    messagesCount: Array.isArray(messages) ? messages.length : 0,
    formDataKeys: Object.keys(formData)
  });

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
                subject: 'OTP',
                text: `Your One-time password is: ${tempPassword}\nPlease use this to log in and reset your password.`
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

  console.log('Registration attempt for user:', userName, 'email:', email, 'contact:', contactNo);

  
 
 
  console.log('Checking if all fields are present');
  if (!userName || !email || !password || !confirmPassword || !contactNo) {
    console.log('Validation failed: All fields are required');
    errors.push('All fields are required.');
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  console.log('Checking email format');
  if (!emailRegex.test(email)) {
    console.log('Validation failed: Invalid email format');
    errors.push('Please enter a valid Gmail address (example@gmail.com).');
  }

  const passwordRegex =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{8,}$/;
  console.log('Checking password strength');
  if (!passwordRegex.test(password)) {
    console.log('Validation failed: Password does not meet requirements');
    errors.push(
      'Password must be at least 8 characters long and include one uppercase letter, one number, and one special character.'
    );
  }

  console.log('Checking password confirmation');
  if (password !== confirmPassword) {
    console.log('Validation failed: Passwords do not match');
    errors.push('Passwords do not match.');
  }

  const contactRegex = /^[0-9]{8}$/;
  console.log('Checking contact number format');
  if (!contactRegex.test(contactNo)) {
    console.log('Validation failed: Invalid contact number');
    errors.push('Please enter a valid 8-digit contact number.');
  }

  if (errors.length > 0) {
    console.log('Registration validation errors:', errors);
    req.flash('error', errors);
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  console.log('Proceeding to duplicate checks');
  const checkEmailSql = 'SELECT * FROM user WHERE email = ?';
  console.log('Checking for duplicate email');
  db.query(checkEmailSql, [email], (err, results) => {
    if (err) {
      console.error('Error checking email:', err);
      req.flash('error', 'An error occurred. Please try again.');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    if (results.length > 0) {
      console.log('Duplicate email found for:', email);
      req.flash('error', 'Email is already in use.');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    // Check username duplicate
    const checkUsernameSql = 'SELECT * FROM user WHERE userName = ?';
    console.log('Checking for duplicate username');
    db.query(checkUsernameSql, [userName], (err, results) => {
      if (err) {
        console.error('Error checking username:', err);
        req.flash('error', 'An error occurred. Please try again.');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }

      if (results.length > 0) {
        console.log('Duplicate username found for:', userName);
        req.flash('error', 'Username is already in use.');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }

      const checkContactSql = 'SELECT * FROM user WHERE contactNo = ?';
      console.log('Checking for duplicate contact number');
      db.query(checkContactSql, [contactNo], (err, results) => {
      if (err) {
        console.error('Error checking contact number:', err);
        req.flash('error', 'An error occurred. Please try again.');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }

      if (results.length > 0) {
        console.log('Duplicate contact number found for:', contactNo);
        req.flash('error', 'Contact number is already in use.');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }

      const insertSql =
        'INSERT INTO user (userName, email, password, contactNo) VALUES (?, ?, SHA(?), ?)';
      console.log('Inserting new user');
      db.query(insertSql, [userName, email, password, contactNo], (err) => {
        if (err) {
          console.error('Error registering user:', err);
          req.flash('error', 'An error occurred while registering. Please try again.');
          req.flash('formData', req.body);
          return res.redirect('/register');
        }

        // ⭐ NEW: auto creates user_progress for new user
        // const getUserIDSql = 'SELECT userID FROM user WHERE email = ?';
        // db.query(getUserIDSql, [email], (err2, resultUser) => {
        //   if (!err2 && resultUser.length > 0) {
        //     const insertProgress = `
        //       INSERT INTO user (userID)
        //       VALUES (?)
        //     `;
        //     db.query(insertProgress, [resultUser[0].userID]);
        //   }

          console.log('User registered successfully:', userName);
          req.flash('success', 'Registration successful. You can now log in.');
          res.render('index', { 
            errors: [], 
            messages: req.flash('success'), 
            formData: {}, 
            user: req.session.user 
          });
        });
      });
    });
  });
};

exports.getAdminDashboard = (req,res) => {

  const username = req.session.user ? req.session.user.userName : 'Guest'; 
  const user = req.session.user 
  const role = req.session.user ? req.session.user.userType : null;

  

  res.render('adminDashboard', {
    user: req.session.user,
    userName: username,
    userType: role,
    loginSuccess: req.flash("loginSuccess")
    

  })
  
  

};

exports.getAllUsers = (req, res) => {
  const user = req.session.user;
  // Trim whitespace from query parameters
  let email = req.query.email ? req.query.email.trim() : '';
  let contactNo = req.query.contactNo ? req.query.contactNo.trim() : '';

  console.log('Search parameters received:', { email, contactNo });

  // If both email and contact number are provided, search for specific user
  if (email && contactNo) {
    const searchSql = 'SELECT * FROM user WHERE email = ? AND contactNo = ?';
    
    console.log('Executing search query with:', email, contactNo);
    
    db.query(searchSql, [email, contactNo], (error, results) => {
      if (error) {
        console.error('Database Query Error', error.message);
        return res.status(500).send('Error searching users');
      }

      console.log('Search results count:', results.length);

      if (results.length === 0) {
        return res.render('adminUsers', {
          users: [],
          user,
          error: 'No user found with the provided email and contact number.',
          success: [],
          searchEmail: email,
          searchContactNo: contactNo
        });
      }

      res.render('adminUsers', {
        users: results,
        user,
        error: null,
        success: [],
        searchEmail: email,
        searchContactNo: contactNo
      });
    });
  } 
  // If only one field is provided, show error
  else if (email || contactNo) {
    console.log('Only one field provided');
    return res.render('adminUsers', {
      users: [],
      user,
      success: [],
      error: 'Both email and contact number are required for search.',
      searchEmail: email,
      searchContactNo: contactNo
    });
  }
  // If no search parameters, show all users
  else {
    console.log('No search parameters, showing all users');
    const sql = 'SELECT * FROM user';
    
    db.query(sql, (error, results) => {
      if (error) {
        console.error('Database Query Error', error.message);
        return res.status(500).send('Error retrieving users');
      }

      res.render('adminUsers', {
        users: results,
        user,
        error: null,
        success: req.flash("success") || [],
        searchEmail: '',
        searchContactNo: ''
      });
    });
  }
};

exports.deleteUser = (req, res) => {
  const userID = req.params.id;
  const currentUser = req.session.user;

  console.log('Attempting to delete user with UserID:', userID);

  // Prevent admin from deleting themselves
  if (currentUser && currentUser.userID == userID) {
    req.flash('error', 'You cannot delete your own account.');
    return res.redirect('/adminUsers');
  }

  // First, check if the user exists
  const checkSql = 'SELECT userName FROM user WHERE UserID = ?';
  db.query(checkSql, [userID], (error, results) => {
    if (error) {
      console.error('Database Query Error:', error.message);
      req.flash('error', 'Error checking user.');
      return res.redirect('/adminUsers');
    }

    if (results.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/adminUsers');
    }

    const userName = results[0].userName;

    // Try to delete the user directly - the database should handle cascading deletes
    const deleteSql = 'DELETE FROM user WHERE UserID = ?';
    db.query(deleteSql, [userID], (error, result) => {
      if (error) {
        console.error('Database Delete Error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        req.flash('error', `Cannot delete user: ${error.message}`);
        return res.redirect('/adminUsers');
      }

      console.log('User deleted successfully:', userName);
      const deletionTime = new Date().toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      });
      req.flash('success', `User "${userName}" has been deleted successfully at ${deletionTime}.`);
      res.redirect('/adminUsers');
    });
  });
};

