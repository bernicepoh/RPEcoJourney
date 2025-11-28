// Controller function for homepage
exports.getHomePage = (req, res) => {
  const username = req.session.user ? req.session.user.userName : null;
  const user = req.session.user 
  res.render('homepage', { user, username,
    loginSuccess: req.flash('loginSuccess'),
   });
};



exports.getAboutPage = (req, res) => {

  const user = req.session.user 
  res.render('aboutus', {user}); 
};

