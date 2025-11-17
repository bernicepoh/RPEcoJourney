const express = require('express');
const userController = require('./controller/userController');
const contentController = require('./controller/contentController');
const categoryController = require('./controller/categoryController');
const homepageController = require('./controller/homepageController');
const quizController = require('./controller/quizController');
const db = require('./db');

const multer = require('multer');
const flash = require('connect-flash'); // ✅ You used flash() but didn’t import it
const session = require('express-session'); // ✅ Required before using flash
const path = require('path');
const app = express();

// Import middleware
const { checkAuthenticated, checkAdmin, checkManager, checkUser } = require('./middleware/auth');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });

// // Import middleware
// const { checkAuthenticated, checkAdmin, checkUser } = require('./middleware/auth');
// const { validateRegistration, validateLogin } = require('./middleware/validation');

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

// Use connect-flash middleware
app.use(flash());

// GLOBAL FLASH MIDDLEWARE
app.use((req, res, next) => {
  res.locals.messages = req.flash(); 
  next();
});

// Make session available in all EJS views
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

app.use('/uploads', express.static('uploads'));

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

//User Routes
app.get('/', userController.getLogin);
app.post('/', userController.login);
app.get('/register',userController.getRegister);
app.post('/register',validateRegistration,userController.register);
app.get('/forgot-password', userController.getForgotPassword);
app.post('/forgot-password', userController.postForgotPassword);
app.post('/reset-password', userController.postResetPassword);

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
app.get('/addContent', contentController.addContentForm);
app.post('/addContent', upload.single('contentFile'), contentController.addContent);

// Like toggle route
app.post('/toggle-like/:contentID', checkAuthenticated, contentController.toggleLike);

// Comment route
app.post('/content/:id/comment', checkAuthenticated, contentController.postComment);
app.post("/comment/edit/:commentID", checkAuthenticated, contentController.editComment);
app.get("/comment/delete/:commentID", checkAuthenticated, contentController.deleteComment);


const { allowAdminOrManager } = require('./middleware/auth');

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

// Quiz Routes
app.get('/quiz', quizController.getQuiz);
app.get('/quiz/category/:id', quizController.getSetByCategory);
app.get('/quiz/category/:categoryID/set/:setNumber', quizController.getQuestionBySets);
app.post('/quiz/submit', quizController.postQuiz);
app.get('/quiz/result', quizController.getQuizResult);

// Error route
app.get('/401', (req, res) => {
    res.render('401', { errors: req.flash('error') });
});

// Start express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));