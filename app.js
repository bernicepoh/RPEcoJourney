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
const db = require('./db'); 

const multer = require('multer');
const session = require('express-session');
const flash = require('connect-flash');  
const path = require('path');
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

// Note: don't automatically consume flash here (controllers should read flash()),
// res.locals.flash is already available via binding above.

app.use('/uploads', express.static('uploads'));

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

//Admin Routes 
app.get('/adminDashboard',allowAdminManagerWriter, userController.getAdminDashboard);
app.get('/adminUsers', checkAdmin, userController.getAllUsers);

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
app.get('/category/:id/content', contentController.getContentByCategory);
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
app.get("/comment/delete/:commentID", checkAuthenticated, contentController.deleteComment);

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


app.get('/ai/select', (req, res) => {
    res.render('aiQuizSelect');
});

app.post('/ai/start', aiQuizController.generateAIQuiz);

app.get("/aiQuizResult", aiQuizController.showQuizResult);

app.post("/ai/insights", aiQuizController.generateInsights);

app.post("/ai/word-meaning", aiQuizController.getWordMeaning);


//CHECK IN DASHBOARD ROUTES
app.get('/checkin-board', checkinController.getCheckInBoard);
app.post('/do-checkin', checkinController.doCheckIn);

//leaderboard 
app.get('/leaderboard', leaderboardController.getLeaderboard);

// Error route
app.get('/401', (req, res) => {
    res.render('401', { errors: req.flash('error') });
});

// Start express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

