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
  const { userName, email, contactNo } = req.body;

  const errors = [];

  // Required fields
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

  if (errors.length > 0) {
    req.flash("error", errors);
    req.flash("formData", req.body);
    return res.redirect("/editProfile/" + userId);
  }

  // Check email duplicate
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

    // Check contact duplicate
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

      // Get existing image
      const getImageSql = "SELECT Image FROM user WHERE userID = ?";
      db.query(getImageSql, [userId], (err, imageResults) => {
        if (err) {
          console.error("Error fetching image:", err);
          req.flash("error", "An error occurred. Please try again.");
          return res.redirect("/editProfile/" + userId);
        }

        let Image = imageResults[0].Image; // keep old image by default

        // If a new image is uploaded, replace it
        if (req.file) {
          // Delete old image file
          if (Image) {
            const fs = require("fs");
            const oldPath = "./public/uploads/" + Image;
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
          Image = req.file.path; // use new image
        }

        // Update profile
        const updateSql = `
          UPDATE user 
          SET userName = ?, email = ?, contactNo = ?, Image = ?
          WHERE userID = ?
        `;
        const params = [userName, email, contactNo, Image, userId];

        db.query(updateSql, params, (err) => {
          if (err) {
            console.error("Error updating profile:", err);
            req.flash("error", "An error occurred. Please try again.");
            return res.redirect("/editProfile/" + userId);
          }

          
          req.session.user.userName = userName;
          req.session.user.email = email;
          req.session.user.contactNo = contactNo;
          req.session.user.Image = Image;

          req.flash("success", "Profile updated successfully!");
          res.redirect("/viewProfile/" + userId);
        });
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

  // First get the user's name
  const getUserSql = "SELECT userName FROM user WHERE userID = ?";
  
  db.query(getUserSql, [userId], (error, userResults) => {
    if (error) {
      console.error("Error fetching user:", error);
      req.flash("error", "Error updating user role");
      return res.redirect('/adminUsers');
    }

    const userName = userResults[0]?.userName || 'User';
    const sql = "UPDATE user SET userType = ? WHERE userID = ?";

    db.query(sql, [userType, userId], (error, results) => {
      if (error) {
        console.error("Error updating user role:", error);
        req.flash("error", "Error updating user role");
        return res.redirect('/adminUsers');
      } else {
        console.log("User role updated successfully");
        const timestamp = new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
        req.flash("success", `Role updated successfully for ${userName} at ${timestamp}`);
        res.redirect('/adminUsers');
      }
    });
  });

};

exports.getViewProfile = (req, res) => {
    const userID = req.session.user.userID;
    const image = req.session.user.Image;
    const sql = 'SELECT * FROM user WHERE userID = ?';

    db.query(sql, [userID, image], (err, results) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).send('Database error');
        }

        if (results.length > 0) {
            const titles = ["Eco Novice", "Eco Learner", "Eco Seeker", "Eco Explorer", "Eco Defender", "Eco Guardian", "Eco Warrior", "Eco Champion", "Eco Hero", "Eco Master", "Eco Legend"];
            const badges = ["eco-novice.png", "eco-defender.png", "eco-seeker.png", "eco-explorer.png", "activist.png", "eco-guardian.png", "eco-warrior.png", "eco-champion.png", "eco-hero.png", "eco-master.png", "eco-legend.png"];
            
            const user = results[0];
            user.levelTitle = titles[Math.min(user.level - 1, 10)];
            user.levelBadge = badges[Math.min(user.level - 1, 10)];
            
            res.render('viewProfile', { 
                user: user,
                error: req.flash("error") || [],
                success: req.flash("success") || []
            });
        } else {
            res.status(404).send('User not found');
        }
    });
};