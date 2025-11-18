// Controller function for homepage
exports.getHomePage = (req, res) => {
  const username = req.session.user ? req.session.user.userName : null;
  const user = req.session.user 
  res.render('homepage', { user, username });
};


// Controller function for About Us page
exports.getAboutPage = (req, res) => {

  const user = req.session.user 
  res.render('aboutus', {user}); // shows aboutus.ejs
};