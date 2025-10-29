const mysql = require('mysql2');

<<<<<<< HEAD
// Database connection details
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Republic_c207',
    database: 'C300_RPecoJourney'
=======
//Database connection details
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'RPEcoJourney',
    port: '3316'
>>>>>>> 565b31a5a070fdf4968dd1ebfc402e121646a5f0
  });

//Connecting to database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

module.exports = db;