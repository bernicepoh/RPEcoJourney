const express = require('express');
const multer = require('multer');
const flash = require('connect-flash'); // ✅ You used flash() but didn’t import it
const session = require('express-session'); // ✅ Required before using flash
const path = require('path');
const app = express();

// // Import middleware
// const { checkAuthenticated, checkAdmin, checkUser } = require('./middleware/auth');
// const { validateRegistration, validateLogin } = require('./middleware/validation');

// // Set up multer for file uploads
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'public/images'); // Directory to save uploaded files
//     },
//     filename: (req, file, cb) => {
//         cb(null, file.originalname);
//     }
// });

// const upload = multer({ storage: storage });

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

// Define routes here
// app.get('/', (req, res) => {

//     let loggedIn = false;
//     if (req.session.user) {
//         loggedIn = true;
//     }
//     res.render('index', { loggedIn });
// });

// ===== Routes =====
// Routes

// app.get('/', (req, res) => res.redirect('index'));  // redirect to real list

// keep your existing root:
// app.get('/', (req, res) => {
//   res.render('home', { loggedIn: !!req.session.user });
// });

app.get('/', (req, res) => res.redirect('categories'));


// ===============================
// CATEGORY ROUTES
// ===============================
const categoryController = require('./controllers/categoryController');
// const { checkAdmin } = require('./middleware/authMiddleware');
// const upload = require('./middleware/uploadMiddleware'); // adjust if you have this

// ===============================
// Public Category routes (read-only)
// ===============================

app.get('/categories', categoryController.getCategories);       // List all categories
app.get('/categories/:id', categoryController.getCategory);     // View single category

// ===============================
// // Admin/Manager restricted Category routes
// ===============================

// ADD CATEGORY (Not Needed for now since group have decided only 3 fixed categories)
// app.get('/categories/add', checkAdmin, categoryController.addCategoryForm);   // Form to add category
// app.post('/categories/add', checkAdmin, upload.single('categoryImage'), categoryController.addCategory);  // Add category

// EDIT CATEGORY
// app.get('/categories/edit/:id', checkAdmin, categoryController.editCategoryForm);   // Form to edit
// app.post('/categories/edit/:id', checkAdmin, upload.single('categoryImage'), categoryController.editCategory);  // Update category

// DELETE CATEGORY
// app.get('/categories/delete/:id', checkAdmin, categoryController.deleteCategory);   // Delete category

// Error route
app.get('/401', (req, res) => {
    res.render('401', { errors: req.flash('error') });
});

// Start express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));