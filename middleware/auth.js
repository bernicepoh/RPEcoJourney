// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.userType === 'Admin') {
        console.log("User has admin rights");
        return next();
    } else {
        console.log("User DO NOT have admin rights");
        res.redirect('/homepage');
    }
};

// Middleware to check if user is manager
const checkManager = (req, res, next) => {
    if (req.session.user && req.session.user.userType === 'Manager') {
        console.log("User has manager rights");
        return next();
    } else {
        console.log("User DO NOT have manager rights");
        req.flash('error', 'Manager access only');
        
    }
};

// Middleware to check Admin or Manager
const allowAdminOrManager = (req, res, next) => {
    const role = req.session.user?.userType;

    if (role === 'Admin' || role === 'Manager') {
        console.log("Access granted: Admin/Manager");
        return next();
    } else {
        console.log("Access denied: Not Admin/Manager");
        req.flash('error', 'Only Admin or Manager can perform this action');
        
    }
};

// Middleware to check if user is normal user
const checkUser = (req, res, next) => {
    if (req.session.user && req.session.user.userType === 'User') {
        console.log("User is logged in");
        return next();
    } else {
        console.log("This function is for users only.");
        req.flash('error', 'This function is for users only.');
       
    }
};


const checkWriter = (req, res, next) => {
    if (req.session.user && req.session.user.userType === 'Writer') {
        console.log("Access denied: Not Writer");
        return next();
    } else {
        console.log("Access denied: Not Admin/Manager");
        req.flash('error', 'Only Admin or Manager can perform this action');
        return res.redirect('/401');

    }
};

const allowAdminManagerWriter = (req, res, next) => {
    const role = req.session.user?.userType;

    if (role === 'Admin' || role === 'Manager' || role === 'Writer') {
        console.log("Access granted: Admin/Manager");
        return next();
    } else {
        console.log("Access denied: Not Admin/Manager/writer");
        req.flash('error', 'Only Admin or Manager can perform this action');
        
    }
};

const allowAdminOrWriter = (req, res, next) => {
    const role = req.session.user?.userType;

    if (role === 'Admin' || role === 'Writer') {
        console.log("Access granted: Admin/Manager");
        return next();
    } else {
        console.log("Access denied: Not Admin/Manager");
        req.flash('error', 'Only Admin or Manager can perform this action');
        
    }
};

module.exports = {
    checkAuthenticated,
    checkAdmin,
    checkManager,
    allowAdminOrManager,
    checkUser,
    checkWriter,
    allowAdminManagerWriter,
    allowAdminOrWriter
};