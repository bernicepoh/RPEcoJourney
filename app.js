const express = require('express');
const userController = require('./controller/userController');
const contentController = require('./controller/contentController');
const categoryController = require('./controller/categoryController');
const homepageController = require('./controller/homepageController');
const quizController = require('./controller/quizController');
const checkinController = require('./controller/checkinController');
const quizDisplayController = require('./controller/quizDisplayController');
const profileController = require('./controller/profileController');
const db = require('./db'); 

const multer = require('multer');
const flash = require('connect-flash'); // ✅ You used flash() but didn’t import it
const session = require('express-session'); // ✅ Required before using flash
const path = require('path');
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });
// // Import middleware
const { checkAuthenticated, checkAdmin, allowAdminOrManager, checkUser } = require('./middleware/auth');


const validateRegistration = (req,res, next) => {
    const { userName, email, password, contactNo } = req.body;
    
    if (!userName || !email || !password || !contactNo) {
        return res.status(400).send('All fields are required');
    }

    if (password.length < 6) {
        req.flash('error', 'Password six characters long');
        req.flash('formData',req.body);
        return res.redirect('/register')
    }
    next()
}

// const checkAdmin = (req, res, next) => {
//     if (req.session.user.userType === 'Admin') {
//         return next();
//     } else {
//         req.flash('error', 'Access denied');
//         res.redirect('/homepage');
//     }
// };

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Enable static files (for CSS, images, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Enable form processing
app.use(express.urlencoded({ 
  extended: false 
}));

app.use(express.json());

// ===== Sessions & flash =====
app.use(session({
  secret: 'secret-key', 
  resave: false,
  saveUninitialized: true,
  // Session expires after 1 week of inactivity
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true }
}));

// Make user session available in ALL EJS files
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Use connect-flash middleware
app.use(flash());

// Make flash available in all EJS views
app.use((req, res, next) => {
    res.locals.flash = req.flash.bind(req);
    next();
});

// Make session available in all EJS views
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

//Profile Routes 
app.get('/editProfile/:id', profileController.getProfile);
app.post('/editProfile/:id',upload.single('Image'), profileController.updateProfile);
app.get('/editUserRole/:id', checkAdmin, profileController.getProfileAdmin);
app.post('/editUserRole/:id', checkAdmin, profileController.updateUserRole);
app.get('/viewProfile/:id', profileController.getViewProfile);


//User Routes
app.get('/', userController.getLogin);
app.post('/', userController.login);
app.get('/register',userController.getRegister);
app.post('/register',upload.single('Image'),validateRegistration,userController.register);
app.get('/forgot-password', userController.getForgotPassword);
app.post('/forgot-password', userController.postForgotPassword);
app.post('/reset-password', userController.postResetPassword);

//Admin Routes 
app.get('/adminDashboard', checkAdmin, userController.getAdminDashboard);
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
app.get('/addContent', checkAdmin, contentController.addContentForm);
app.post('/addContent', checkAdmin, upload.single('contentFile'), contentController.addContent);
app.get('/editContent/:id', checkAdmin, contentController.editContentForm);
app.post('/editContent/:id', checkAdmin, upload.single('contentFile'), contentController.editContent);
app.post('/deleteContent/:id', checkAdmin, contentController.deleteContent);


// Like toggle route
app.post('/toggle-like/:contentID', checkAuthenticated, contentController.toggleLike);
//app.get('/likes/:id', contentController.getLikesList);

// Comment route
app.post('/content/:id/comment', checkAuthenticated, contentController.postComment);
app.post("/comment/edit/:commentID", checkAuthenticated, contentController.editComment);
app.get("/comment/delete/:commentID", checkAdmin, contentController.deleteComment);

// Category routes
app.get('/categories', categoryController.getCategories);       // List all categories
app.get('/categories/:id', categoryController.getCategory);     // View single category
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

/* =======================
      QUIZ ROUTES
======================== */

// Main quiz page
app.get('/quiz', quizController.getQuiz);

// Category → sets
app.get('/quiz/category/:id', quizController.getSetByCategory);

// Start game (handles guest + real user logic)
app.get('/startGame/:categoryID/:setNumber', quizController.startGame);

// Actual quiz page (first question)
// app.get('/quizPage/:categoryID/:setNumber', quizController.showQuizPage);

// Submit answer
app.post('/quiz/game/answer', quizController.answerGame);

// Next question
app.get('/quiz/game/next/:currentID/:categoryID/:setNumber', quizController.nextGameQuestion);

// Completed quiz
app.get('/quiz/game/complete/:categoryID/:setNumber', quizController.completeGame);

/* =======================
      QR QUIZ ROUTES
======================== */

app.get('/quiz-start', quizDisplayController.showQuizStart);     // TV QR screen
app.get('/quiz-access', quizDisplayController.showQuizAccess);   // Phone: choose guest/login
app.get('/guest-start', quizDisplayController.startAsGuest);     // Create guest session

// Guest welcome screen (reuse quiz-access.ejs)
app.get('/guest-welcome', (req, res) => {
    res.render("quiz-access", { guestMode: true });
});



//CHECK IN DASHBOARD ROUTES
app.get('/checkin-board', checkinController.getCheckInBoard);
app.post('/do-checkin', checkinController.doCheckIn);


// Error route
app.get('/401', (req, res) => {
    res.render('401', { errors: req.flash('error') });
});

// Start express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));