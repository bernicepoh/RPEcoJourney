const express = require('express');
const userController = require('./controller/userController');
const contentController = require('./controller/contentController');
const db = require('./db');

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

app.use(flash());

app.get('/', (req, res) => {
    res.render('index');
});

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

// Connect to PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});