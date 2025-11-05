const db = require('../db');

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
