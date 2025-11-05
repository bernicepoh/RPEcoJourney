const express = require('express');
const indexController = require('./controller/index');



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
 

app.get('/', indexController.getLogin);
app.post('/', indexController.login);
app.get('/register',indexController.getRegister);
app.post('/register',validateRegistration,indexController.register);

// Connect to PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});