const db = require('../db');
const nodemailer = require('nodemailer');

exports.getProfile = (req, res) => {
    const userID = req.session.user.userID;
    const sql = 'SELECT * FROM user WHERE userID = ?';

    db.query(sql, [userID], (err, results) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).send('Database error');
        }

        if (results.length > 0) {
            res.render('editProfile', { 
                user: results[0],
                error: req.flash("error") || [],
                success: req.flash("success") || []
            });
        } else {
            res.status(404).send('User not found');
        }
    });
};

exports.updateProfile = (req, res) => {
  const userId = req.session.user.userID; 
  const { userName, email, password, confirmPassword, contactNo } = req.body;

  const errors = [];

  if (!userName || !email || !contactNo) {
    errors.push("Username, email and contact number are required.");
  }

  // Email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!emailRegex.test(email)) {
    errors.push("Please enter a valid Gmail address (example@gmail.com).");
  }

  // Contact validation
  const contactRegex = /^[0-9]{8}$/;
  if (!contactRegex.test(contactNo)) {
    errors.push("Please enter a valid 8-digit contact number.");
  }

  // Password validation only if user changed password
  let updatePassword = false;
  if (password || confirmPassword) {
    updatePassword = true;

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{8,}$/;

    if (!passwordRegex.test(password)) {
      errors.push(
        "Password must be at least 8 characters long and include one uppercase letter, one number, and one special character."
      );
    }

    if (password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }
  }

  if (errors.length > 0) {
    req.flash("error", errors);
    req.flash("formData", req.body);
    return res.redirect("/editProfile/" + userId);
  }

  // Check for duplicate email
  const checkEmailSql = "SELECT * FROM user WHERE email = ? AND userID != ?";
  db.query(checkEmailSql, [email, userId], (err, emailResults) => {
    if (err) {
      console.error("Error checking email:", err);
      req.flash("error", "An error occurred. Please try again.");
      return res.redirect("/editProfile/" + userId);
    }

    if (emailResults.length > 0) {
      req.flash("error", "Email is already in use.");
      return res.redirect("/editProfile/" + userId);
    }

    // Check duplicate contact
    const checkContactSql = "SELECT * FROM user WHERE contactNo = ? AND userID != ?";
    db.query(checkContactSql, [contactNo, userId], (err, contactResults) => {
      if (err) {
        console.error("Error checking contact:", err);
        req.flash("error", "An error occurred. Please try again.");
        return res.redirect("/editProfile/" + userId);
      }

      if (contactResults.length > 0) {
        req.flash("error", "Contact number is already in use.");
        return res.redirect("/editProfile/" + userId);
      }

      // Build SQL Update query
      let updateSql = "UPDATE user SET userName = ?, email = ?, contactNo = ?";
      let params = [userName, email, contactNo];

      if (updatePassword) {
        updateSql += ", password = SHA(?)";
        params.push(password);
      }

      updateSql += " WHERE userID = ?";
      params.push(userId);

      db.query(updateSql, params, (err) => {
        if (err) {
          console.error("Error updating profile:", err);
          req.flash("error", "An error occurred. Please try again.");
          return res.redirect("/editProfile/" + userId);
        }

        // Update session info
        req.session.user.userName = userName;
        req.session.user.email = email;
        req.session.user.contactNo = contactNo;

        
        res.redirect("/homepage"); 
      });
    });
  });
};

exports.getProfileAdmin = (req, res) => {
     const userID = req.params.id;
    const sql = 'SELECT * FROM user WHERE userID = ?';

    db.query(sql, [userID], (err, results) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).send('Database error');
        }

        if (results.length > 0) {
            res.render('editUserRole', { 
                user: results[0],
                error: req.flash("error") || [],
                success: req.flash("success") || []
            });
        } else {
            res.status(404).send('User not found');
        }
    });
};

exports.updateUserRole = (req, res) => {

  const userId = req.params.id;
  const { userType } = req.body;

  const sql = "UPDATE user SET userType = ? WHERE userID = ?";

  db.query(sql, [userType, userId], (error, results) => {
    if (error) {
      console.error("Error updating user role:", error);
      return res.status(500).send('Error updating user role');
    } else {
      console.log("User role updated successfully");
      res.redirect('/adminUsers');
    }
  }) ;

};
