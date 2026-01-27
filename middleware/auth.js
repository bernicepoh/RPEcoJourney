// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash('error', 'Please log in to view this resource');
    return res.redirect('/');
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user?.userType === 'Admin') {
        return next();
    }
    req.flash('error', 'Admin access only');
    return res.redirect('/401');
};

// Middleware to check if user is manager
const checkManager = (req, res, next) => {
    if (req.session.user?.userType === 'Manager') {
        return next();
    }
    req.flash('error', 'Manager access only');
    return res.redirect('/401');
};

// Admin OR Manager
const allowAdminOrManager = (req, res, next) => {
    const role = req.session.user?.userType;
    if (role === 'Admin' || role === 'Manager') {
        return next();
    }
    req.flash('error', 'Only Admin or Manager can perform this action');
    return res.redirect('/401');
};

// Normal user only
const checkUser = (req, res, next) => {
    if (req.session.user?.userType === 'User') {
        return next();
    }
    req.flash('error', 'User access only');
    return res.redirect('/401');
};

// Writer only
const checkWriter = (req, res, next) => {
    if (req.session.user?.userType === 'Writer') {
        return next();
    }
    req.flash('error', 'Writer access only');
    return res.redirect('/401');
};

// Admin OR Manager OR Writer
const allowAdminManagerWriter = (req, res, next) => {
    const role = req.session.user?.userType;
    if (['Admin', 'Manager', 'Writer'].includes(role)) {
        return next();
    }
    req.flash('error', 'Access denied');
    return res.redirect('/401');
};

// Admin OR Writer
const allowAdminOrWriter = (req, res, next) => {
    const role = req.session.user?.userType;
    if (role === 'Admin' || role === 'Writer') {
        return next();
    }
    req.flash('error', 'Access denied');
    return res.redirect('/401');
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