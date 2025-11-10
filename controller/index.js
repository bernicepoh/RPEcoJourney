// Controller function for homepage
exports.getHomePage = (req, res) => {
  res.render('index'); // shows index.ejs
};

// Controller function for About Us page
exports.getAboutPage = (req, res) => {
  res.render('aboutus'); // shows aboutus.ejs
};