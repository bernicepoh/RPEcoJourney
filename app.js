const express = require('express');
const contentController = require('./controller/contentController');

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