const mysql = require('mysql2');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Republic_C207',
    database: 'rpecojourney'
  });

module.exports = db;



// const mysql = require('mysql2');

// // Database connection details
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: 'Republic_C207',
//     database: 'RPEcoJourney'
// });

// //Connecting to database
// db.connect((err) => {
//     if (err) {
//         console.error('Error connecting to MySQL:', err);
//         return;
//     }
//     console.log('Connected to MySQL database');
// });

// module.exports = db;