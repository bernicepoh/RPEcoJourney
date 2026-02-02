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

const { cloudinary, parser } = require('./cloudinary');


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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));


app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(cookieParser());


app.use(session({
  secret: 'secret-key', 
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true }
}));


app.use(flash());


app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use((req, res, next) => {
    res.locals.flash = req.flash.bind(req);
    next();
});

app.use((req, res, next) => {
    res.locals.currentLanguage = req.session.language || req.cookies.language || 'en';
    next();
});

app.use(translationMiddleware);

const localeFiles = {
    en: require('./locales/en.json'),
    ms: require('./locales/ms.json'),
    ta: require('./locales/ta.json'),
    zh: require('./locales/zh.json')
};

app.use((req, res, next) => {
    res.locals.getTranslation = (key, lang = null) => {
        const currentLang = lang || req.session.language || req.cookies.language || 'en';
        const locale = localeFiles[currentLang] || localeFiles.en;
        
      
        const keys = key.split('.');
        let value = locale;
        for (let k of keys) {
            value = value[k];
            if (!value) break;
        }
        
        return value || key;
    };
    
    next();
});
app.post('/change-language', (req, res) => {
    const { language } = req.body;
    const validLanguages = ['en', 'ms', 'ta', 'zh'];
    
    if (validLanguages.includes(language)) {
        req.session.language = language;
        res.cookie('language', language, { maxAge: 365 * 24 * 60 * 60 * 1000 }); 
    }
    
    res.redirect(req.get('referer') || '/');
});

//Profile Routes 
app.get('/editProfile/:id', profileController.getProfile);
app.post('/editProfile/:id',parser.single('image'), profileController.updateProfile);
app.get('/editUserRole/:id', checkAdmin, profileController.getProfileAdmin);
app.post('/editUserRole/:id', checkAdmin, profileController.updateUserRole);
app.get('/viewProfile/:id', profileController.getViewProfile);


//User Routes
app.get('/', userController.getLogin);
app.post('/', userController.login);
app.get('/register',userController.getRegister);
app.post('/register',parser.single('image'),validateRegistration,userController.register);
app.get('/forgot-password', userController.getForgotPassword);
app.post('/forgot-password', userController.postForgotPassword);
app.post('/reset-password', userController.postResetPassword);


app.get('/guest', (req, res) => {
    
    req.session.user = { userType: 'Guest' };
    res.render('guest', {
        user: { userType: 'Guest' }
    });
});

 
app.get('/adminDashboard',allowAdminManagerWriter, userController.getAdminDashboard);
app.get('/adminUsers', checkAdmin, userController.getAllUsers);
app.post('/deleteUser/:id', checkAdmin, userController.deleteUser);


function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
}

app.get('/contentType/:id/content', contentController.getContentByContentType);
app.get('/content/:id', contentController.getContent);
app.get('/addContent', allowAdminOrWriter, contentController.addContentForm);
app.post('/addContent', allowAdminOrWriter, parser.single('contentFile'), contentController.addContent);
app.get('/editContent/:id', checkAdmin, contentController.editContentForm);
app.post('/editContent/:id', checkAdmin, parser.single('contentFile'), contentController.editContent);
app.post('/deleteContent/:id', checkAdmin, contentController.deleteContent);
app.get('/manageContent', allowAdminOrWriter, contentController.manageContent);


app.post('/toggle-like/:contentID', checkAuthenticated, contentController.toggleLike);

app.post('/content/:id/comment', checkAuthenticated, contentController.postComment);
app.post("/comment/edit/:commentID", checkAuthenticated, contentController.editComment);
app.post("/comment/delete/:commentID", checkAuthenticated, contentController.deleteComment);
app.post("/comment/unblock/:commentID", checkAuthenticated, contentController.unblockComment);


app.post('/comment/block/:id', contentController.blockComment);


app.get('/content-requests', allowAdminOrManager, contentController.getContentRequests);
app.post('/admin/content-requests/approve/:id', allowAdminOrManager, contentController.approveContentRequest);
app.post('/admin/content-requests/reject/:id', allowAdminOrManager, contentController.rejectContentRequest);


app.get('/categories', categoryController.getCategories);       
app.get('/categories/:id', categoryController.getCategory);    


app.get('/ngrok-url', (req, res) => {
    const ngrokUrl = process.env.NGROK_URL || null;
    res.json({ url: ngrokUrl });
});
app.post("/share/:contentID", checkAuthenticated, contentController.trackShare);


app.get('/manageCategories', allowAdminOrManager, categoryController.getManageCategories)


app.get('/addCategory', allowAdminOrManager, categoryController.addCategoryForm);
app.post('/addCategory', allowAdminOrManager, parser.single('categoryImage'), categoryController.addCategory);

app.get('/editCategory/:id', allowAdminOrManager, categoryController.editCategoryForm);
app.post('/editCategory/:id', allowAdminOrManager, parser.single('categoryImage'), categoryController.updateCategory);

app.post('/deleteCategory/:id', allowAdminOrManager, categoryController.deleteCategory);


app.get('/homepage', homepageController.getHomePage);

app.get('/aboutus', homepageController.getAboutPage);


const signageController = require('./controller/signageController');

app.get('/admin/editor', checkAdmin, signageController.getEditor);

app.post('/admin/save-layout', signageController.saveLayout);

app.get('/api/screen/:id', signageController.getScreenContent);

app.get('/display/:id', signageController.getDisplay);

app.use('/uploads', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); 
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

app.get('/admin/dashboard/stats', admindashboardController.getAdminDashboardStats);

app.get('/admin/dashboard/debug', admindashboardController.debugGAResponse);



app.get('/checkin-board',checkUser, checkinController.getCheckInBoard);
app.post('/do-checkin', checkinController.doCheckIn);


app.get('/leaderboard', leaderboardController.getLeaderboard);


app.get('/xphistory', checkAuthenticated, xpController.getXPHistory);



app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
  
    if (err.code === 'FILE_TOO_LARGE') {
      req.flash('error', 'File size exceeds 10MB limit.');
    } else if (err.code === 'LIMIT_FILE_SIZE') {
      req.flash('error', 'File size exceeds 10MB limit.');
    } else {
      console.error('Multer Error:', err.message);
      req.flash('error', 'File upload failed: ' + err.message);
    }
  } else if (err && err.message && err.message.includes('not allowed')) {
   
    console.error('File validation error:', err.message);
    req.flash('error', err.message);
  } else if (err) {
 
    console.error('Upload error:', err.message);
    req.flash('error', 'Upload failed. Please try again.');
  }
  
  const referer = req.get('referer');
  if (referer && referer.includes('/editContent')) {
    const match = referer.match(/\/editContent\/(\d+)/);
    if (match) {
      return res.redirect(`/editContent/${match[1]}`);
    }
  }
  
  res.redirect('/addContent');
});

app.get('/401', (req, res) => {
    res.render('401', { errors: req.flash('error') });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

