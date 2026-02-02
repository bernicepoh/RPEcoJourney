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
const admindashboardController = require('./controller/admindashboardController');
const db = require('./db'); 

const multer = require('multer');
const session = require('express-session');
const flash = require('connect-flash');  
const path = require('path');
const cookieParser = require('cookie-parser');
const { translationMiddleware, translateText } = require('./middleware/translator');
const app = express();

// multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Import middleware
const { checkAuthenticated, checkAdmin, allowAdminOrManager, checkUser, checkWriter, allowAdminManagerWriter, allowAdminOrWriter } = require('./middleware/auth');

const validateRegistration = (req,res, next) => {
    const { userName, email, password, confirmPassword, contactNo } = req.body;
    console.log('validateRegistration: attempt', { userName, email, contactNo });

    if (!userName || !email || !password || !confirmPassword || !contactNo) {
        console.log('validateRegistration: missing fields', { userNamePresent: !!userName, emailPresent: !!email, passwordPresent: !!password, contactNoPresent: !!contactNo });
        req.flash('error', ['All fields are required.']);
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    if (password.length < 8) {
        console.log('validateRegistration: password too short', { userName, email });
        req.flash('error', 'Password eight characters long');
        req.flash('formData',req.body);
        return res.redirect('/register')
    }

    console.log('validateRegistration: passed basic checks');
    next()
}

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Enable static files (for CSS, images, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Enable form processing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Cookie parser for language persistence
app.use(cookieParser());

// Session
app.use(session({
  secret: 'secret-key', 
  resave: false,
  saveUninitialized: true,
  // Session expires after 1 week of inactivity
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true }
}));

// Use connect-flash middleware
app.use(flash());

// Make user session available in ALL EJS files
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Make flash available in all EJS views
app.use((req, res, next) => {
    res.locals.flash = req.flash.bind(req);
    next();
});

// Make current language available in all views
app.use((req, res, next) => {
    res.locals.currentLanguage = req.session.language || req.cookies.language || 'en';
    next();
});

// Translation middleware
app.use(translationMiddleware);



app.use('/uploads', express.static('uploads'));

// Language switching route
app.post('/change-language', (req, res) => {
    const { language } = req.body;
    const validLanguages = ['en', 'ms', 'ta', 'zh'];
    
    if (validLanguages.includes(language)) {
        req.session.language = language;
        res.cookie('language', language, { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 year
    }
    
    res.redirect(req.get('referer') || '/');
});

//Profile Routes 
app.get('/editProfile/:id', profileController.getProfile);
app.post('/editProfile/:id',upload.single('image'), profileController.updateProfile);
app.get('/editUserRole/:id', checkAdmin, profileController.getProfileAdmin);
app.post('/editUserRole/:id', checkAdmin, profileController.updateUserRole);
app.get('/viewProfile/:id', profileController.getViewProfile);


//User Routes
app.get('/', userController.getLogin);
app.post('/', userController.login);
app.get('/register',userController.getRegister);
app.post('/register',upload.single('image'),validateRegistration,userController.register);
app.get('/forgot-password', userController.getForgotPassword);
app.post('/forgot-password', userController.postForgotPassword);
app.post('/reset-password', userController.postResetPassword);

// Guest Route
app.get('/guest', (req, res) => {
    // Set guest user in session
    req.session.user = { userType: 'Guest' };
    res.render('guest', {
        user: { userType: 'Guest' }
    });
});

//Admin Routes 
app.get('/adminDashboard',allowAdminManagerWriter, userController.getAdminDashboard);
app.get('/adminUsers', checkAdmin, userController.getAllUsers);
app.post('/deleteUser/:id', checkAdmin, userController.deleteUser);

//testing forget password route
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
}

// Content Routes
app.get('/contentType/:id/content', contentController.getContentByContentType);
app.get('/content/:id', contentController.getContent);
app.get('/addContent', allowAdminOrWriter, contentController.addContentForm);
app.post('/addContent', allowAdminOrWriter, upload.single('contentFile'), contentController.addContent);
app.get('/editContent/:id', checkAdmin, contentController.editContentForm);
app.post('/editContent/:id', checkAdmin, upload.single('contentFile'), contentController.editContent);
app.post('/deleteContent/:id', checkAdmin, contentController.deleteContent);
app.get('/manageContent', allowAdminOrWriter, contentController.manageContent);

// Like toggle route
app.post('/toggle-like/:contentID', checkAuthenticated, contentController.toggleLike);
// app.get('/likes-list/:id', contentController.getLikesList);

// Comment route
app.post('/content/:id/comment', checkAuthenticated, contentController.postComment);
app.post("/comment/edit/:commentID", checkAuthenticated, contentController.editComment);
app.post("/comment/delete/:commentID", checkAuthenticated, contentController.deleteComment);
app.post("/comment/unblock/:commentID", checkAuthenticated, contentController.unblockComment);

// Admin/Manager block comment
app.post('/comment/block/:id', contentController.blockComment);

// Content Requests Routes
// app.get('/content-requests', checkAdmin, contentController.getContentRequests);
// app.post('/admin/content-requests/approve/:id', checkAdmin, contentController.approveContentRequest);
// app.post('/admin/content-requests/reject/:id', checkAdmin, contentController.rejectContentRequest);

// Category routes
app.get('/categories', categoryController.getCategories);       // List all categories 
app.get('/categories/:id', categoryController.getCategory);     // View single category

// Share Button Route
// Detect ngrok URL automatically
app.get('/ngrok-url', (req, res) => {
    const ngrokUrl = process.env.NGROK_URL || null;
    res.json({ url: ngrokUrl });
});
app.post("/share/:contentID", checkAuthenticated, contentController.trackShare);

// Admin/Manager List All Categories
app.get('/manageCategories', allowAdminOrManager, categoryController.getManageCategories)

// ADD Category
app.get('/addCategory', allowAdminOrManager, categoryController.addCategoryForm);
app.post('/addCategory', allowAdminOrManager, upload.single('categoryImage'), categoryController.addCategory);
// EDIT Category
app.get('/editCategory/:id', allowAdminOrManager, categoryController.editCategoryForm);
app.post('/editCategory/:id', allowAdminOrManager, upload.single('categoryImage'), categoryController.updateCategory);
// DELETE Category
app.post('/deleteCategory/:id', allowAdminOrManager, categoryController.deleteCategory);

// Home page
app.get('/homepage', homepageController.getHomePage);
// About Us page
app.get('/aboutus', homepageController.getAboutPage);

// Digital Signage Routes
const signageController = require('./controller/signageController');
// Open the editor (For your laptop)
app.get('/admin/editor', checkAdmin, signageController.getEditor);
// Save logic (Laptop -> Database)
app.post('/admin/save-layout', signageController.saveLayout);
// Pi Fetch logic (Pi -> Database)
app.get('/api/screen/:id', signageController.getScreenContent);
// NEW: The actual page the TV shows (The "Slide Show" mode)
app.get('/display/:id', signageController.getDisplay);
// Allows the Pi to access these files
app.use('/uploads', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // Allows any device to see the image
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
}, express.static(path.join(__dirname, 'public/uploads'))); 

app.get('/ai/select',checkUser, (req, res) => {
    res.render('aiQuizSelect');
});

app.post('/ai/start', aiQuizController.generateAIQuiz);

app.get("/aiQuizResult", aiQuizController.showQuizResult);

app.post("/ai/insights", aiQuizController.generateInsights);

app.post("/ai/word-meaning", aiQuizController.getWordMeaning);

app.get('/adminDashboard', checkAdmin, admindashboardController.getAdminDashboardPage);
// DATA - Google Analytics Stats API (NO AUTH NEEDED FOR TESTING)
app.get('/admin/dashboard/stats', admindashboardController.getAdminDashboardStats);
// DEBUG - Raw GA Response
app.get('/admin/dashboard/debug', admindashboardController.debugGAResponse);


//CHECK IN DASHBOARD ROUTES
app.get('/checkin-board',checkUser, checkinController.getCheckInBoard);
app.post('/do-checkin', checkinController.doCheckIn);

//leaderboard 
app.get('/leaderboard', leaderboardController.getLeaderboard);

// XP History Route
app.get('/xphistory', checkAuthenticated, xpController.getXPHistory);


// Error route
app.get('/401', (req, res) => {
    res.render('401', { errors: req.flash('error') });
});

// Start express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

