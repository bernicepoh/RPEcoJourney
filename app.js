const express = require('express');
const userController = require('./controller/userController');
const contentController = require('./controller/contentController');
const categoryController = require('./controllers/categoryController');
const mainController = require('./controller/index');
const quizController = require('./controller/quizController');
const db = require('./db');


const userController = require('./controllers/userController');
const productController = require('./controllers/productController');
const catController = require('./controllers/catController');
const orderController = require('./controllers/orderController');
const cartController = require('./controllers/cartController');

const multer = require('multer');
const flash = require('connect-flash'); // ✅ You used flash() but didn’t import it
const session = require('express-session'); // ✅ Required before using flash
const path = require('path');
const app = express();

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

// Make session available in all EJS views
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

app.use('/uploads', express.static('uploads'));


const upload = multer({ storage: storage });

app.use(flash());

app.get('/', (req, res) => res.redirect('categories'));

app.get('/category', (req, res) => {
    res.render('category');
});

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

// Category routes
app.get('/categories', categoryController.getCategories);       // List all categories
app.get('/categories/:id', categoryController.getCategory);     // View single category


// Home page
app.get('/', userController.getHomePage);
// About Us page
app.get('/aboutus', userController.getAboutPage);

// Quiz Routes
app.get('/quiz', (req, res) => quizController.getQuizCategories(req, res, connection));
app.get('/quiz/category/:id', (req, res) => quizController.getQuizSets(req, res, connection));
app.get('/quiz/category/:categoryId/set/:setNumber', (req, res) => quizController.getQuizPage(req, res, connection));
app.post('/quiz/submit', (req, res) => quizController.submitQuiz(req, res, connection));
app.get('/quiz/result', (req, res) => quizController.getResultPage(req, res, connection));

app.get('/', productController.getProduct);
app.get('/products', productController.getProducts);
app.get('/product/:id', productController.getproductId);
app.get('/editproduct/:id', productController.editproduct);
app.post('/editproduct/:id',upload.single('image'), productController.editproductForm);
app.get('/addproduct', productController.getproductForm);
app.get('/', (req, res) => {
    res.render('index');
});

// Error route
app.get('/401', (req, res) => {
    res.render('401', { errors: req.flash('error') });
});

// Start express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));