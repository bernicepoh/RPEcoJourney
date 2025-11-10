const express = require('express');

const mainController = require('./controller/index');
const quizController = require('./controller/quizController');
const userController = require('./controllers/userController');
const productController = require('./controllers/productController');
const catController = require('./controllers/catController');
const orderController = require('./controllers/orderController');
const cartController = require('./controllers/cartController');

const multer = require('multer');
const ses = require('express-session');
const flash = require('connect-flash');

const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});


// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));



const upload = multer({ storage: storage });


// Session Middleware
app.use(ses({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Cookies expires after 1 week of inactivity
    cookie: {maxAge: 1000 * 60 *60 * 24 * 7}
}));

app.use(flash());

// Home page
app.get('/', userController.getHomePage);
// About Us page
app.get('/aboutus', userController.getAboutPage);


// ==== QUIZ SECTION ====
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

app.get('/categories', catController.getCat);
app.post('/addReview',catController.addReview);
app.get('/review/:productId', catController.getOrderItems);
app.get('/categoriesAdmin', catController.getCatA);
app.get('/editCategories/:categoryId', catController.Cat);
app.post('/editCategories/:categoryId', upload.single('categoryImage'), catController.editCat);
app.get('/deleteCategory/:categoryId', catController.delCat);
app.get('/addCategories', catController.getAdd);
app.post('/addCategories', upload.single('categoryImage'), catController.addCat);

// Route to delete a specific item from the cart
app.get('/DeleteCartItem/:id', cartController.DeleteCartItem);

// Home route (Display Shopping Cart)
app.get('/', cartController.GetCartItems);

// Debugging: Logs for cartController
console.log(cartController);
console.log(cartController.GetCartItems);
console.log(cartController.DeleteCartItem);
app.get('/DeleteCartItem/:id', cartController.DeleteCartItem);

// Home route (Display Shopping Cart)
app.get('/shoppingcart', cartController.GetCartItems);

// Define routes
app.get('/order', orderController.getOrdersUser);

app.get('/card', orderController.getCard);

app.get('/paynow', orderController.getPaynow);

app.get('/paypal', orderController.getPaypal);

app.get('/orderPlaced', orderController.getorderPlaced);

app.get('/cancelOrder/:id', orderController.cancelOrder);

app.get('/deliveryStatus', orderController.getdeliveryStatus);

app.get('/editAddress/:userId', orderController.editAddressForm);

app.post('/editAddress/:userId', orderController.editAddress);


// Define Login Page Route
app.get('/', userController.getAboutPage);
// Define Register Page Route
app.get('/register', userController.getRegister);
app.post('/register', userController.RegisterUser);
// Login route to render login page
app.get("/login", userController.getLoginPage);
// Login route for form submission
app.post("/login", userController.LoginUser);
// User profile page route
app.get('/profile', userController.getProfile);
// Edit Profile Form routes
app.get('/editProfile/:id', userController.getEditProfile);
app.post('/editProfile/:id', upload.single("image"), userController.editProfile);
// Logout route
app.get('/logout', userController.Logout);
// Users database page routes
app.get('/user', userController.getUsers);
app.get('/user/:id', userController.getUser);
app.get('/user/:id/delete', userController.deleteUser);
//  Admin database page routes
app.get('/addAdmin', userController.getAddAdmin);
app.post('/addAdmin', userController.addAdmin)
app.get('/admin', userController.getAdmins);
app.get('/admin/:id', userController.getAdmin);
app.get('/admin/:id/delete', userController.deleteAdmin);

// Connect to PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});