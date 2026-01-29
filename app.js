require('dotenv').config();
const express = require('express');
const userController = require('./controller/userController');
const contentController = require('./controller/contentController');
const categoryController = require('./controller/categoryController');
const homepageController = require('./controller/homepageController');
const checkinController = require('./controller/checkinController');
const profileController = require('./controller/profileController');
const leaderboardController = require('./controller/leaderboardController');
const aiQuizController = require('./controller/aiQuizController');
const xpController = require('./controller/xpcontroller');
const db = require('./db');

const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const app = express();

// ✅ Cloudinary Multer parser
const { parser } = require('./cloudinary');

// Import middleware
const {
  checkAuthenticated,
  checkAdmin,
  allowAdminOrManager,
  checkUser,
  checkWriter,
  allowAdminManagerWriter,
  allowAdminOrWriter
} = require('./middleware/auth');

const validateRegistration = (req, res, next) => {
  const { userName, email, password, confirmPassword, contactNo } = req.body;
  console.log('validateRegistration: attempt', { userName, email, contactNo });

  if (!userName || !email || !password || !confirmPassword || !contactNo) {
    req.flash('error', ['All fields are required.']);
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  if (password.length < 8) {
    req.flash('error', 'Password eight characters long');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  next();
};

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true
  }
}));

// Flash
app.use(flash());

// Make user session available globally
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Flash helper
app.use((req, res, next) => {
  res.locals.flash = req.flash.bind(req);
  next();
});

/* ============================
   PROFILE ROUTES
============================ */
app.get('/editProfile/:id', profileController.getProfile);
app.post('/editProfile/:id',
  parser.single('image'),
  profileController.updateProfile
);
app.get('/editUserRole/:id', checkAdmin, profileController.getProfileAdmin);
app.post('/editUserRole/:id', checkAdmin, profileController.updateUserRole);
app.get('/viewProfile/:id', profileController.getViewProfile);

/* ============================
   USER ROUTES
============================ */
app.get('/', userController.getLogin);
app.post('/', userController.login);
app.get('/register', userController.getRegister);
app.post('/register',
  parser.single('image'),
  validateRegistration,
  userController.register
);
app.get('/forgot-password', userController.getForgotPassword);
app.post('/forgot-password', userController.postForgotPassword);
app.post('/reset-password', userController.postResetPassword);

/* ============================
   ADMIN ROUTES
============================ */
app.get('/adminDashboard', allowAdminManagerWriter, userController.getAdminDashboard);
app.get('/adminUsers', checkAdmin, userController.getAllUsers);

/* ============================
   CONTENT ROUTES
============================ */
app.get('/contentType/:id/content', contentController.getContentByContentType);
app.get('/content/:id', contentController.getContent);
app.get('/addContent', allowAdminOrWriter, contentController.addContentForm);

app.post('/addContent',
  allowAdminOrWriter,
  parser.single('contentFile'),
  contentController.addContent
);

app.get('/editContent/:id', checkAdmin, contentController.editContentForm);

app.post('/editContent/:id',
  checkAdmin,
  parser.single('contentFile'),
  contentController.editContent
);

app.post('/deleteContent/:id', checkAdmin, contentController.deleteContent);
app.get('/manageContent', allowAdminOrWriter, contentController.manageContent);

// Likes & comments
app.post('/toggle-like/:contentID', checkAuthenticated, contentController.toggleLike);
app.post('/content/:id/comment', checkAuthenticated, contentController.postComment);
app.post('/comment/edit/:commentID', checkAuthenticated, contentController.editComment);
app.post('/comment/delete/:commentID', checkAuthenticated, contentController.deleteComment);
app.post('/comment/unblock/:commentID', checkAuthenticated, contentController.unblockComment);
app.post('/comment/block/:id', contentController.blockComment);

/* ============================
   CATEGORY ROUTES
============================ */
app.get('/categories', categoryController.getCategories);
app.get('/categories/:id', categoryController.getCategory);

app.get('/manageCategories', allowAdminOrManager, categoryController.getManageCategories);
app.get('/addCategory', allowAdminOrManager, categoryController.addCategoryForm);

app.post('/addCategory',
  allowAdminOrManager,
  parser.single('categoryImage'),
  categoryController.addCategory
);

app.get('/editCategory/:id', allowAdminOrManager, categoryController.editCategoryForm);

app.post('/editCategory/:id',
  allowAdminOrManager,
  parser.single('categoryImage'),
  categoryController.updateCategory
);

app.post('/deleteCategory/:id', allowAdminOrManager, categoryController.deleteCategory);

/* ============================
   OTHER PAGES
============================ */
app.get('/homepage', homepageController.getHomePage);
app.get('/aboutus', homepageController.getAboutPage);

// AI quiz
app.get('/ai/select', (req, res) => res.render('aiQuizSelect'));
app.post('/ai/start', aiQuizController.generateAIQuiz);
app.get('/aiQuizResult', aiQuizController.showQuizResult);
app.post('/ai/insights', aiQuizController.generateInsights);
app.post('/ai/word-meaning', aiQuizController.getWordMeaning);

// Check-in
app.get('/checkin-board', checkinController.getCheckInBoard);
app.post('/do-checkin', checkinController.doCheckIn);

// Leaderboard
app.get('/leaderboard', leaderboardController.getLeaderboard);

// XP history
app.get('/xphistory', checkAuthenticated, xpController.getXPHistory);

// Error
app.get('/401', (req, res) => {
  res.render('401', { errors: req.flash('error') });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));