const mysql = require('mysql2');


// Database connection details
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Republic_c207',
    database: 'c300_project',
    
});

// Connecting to database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

module.exports = db;
