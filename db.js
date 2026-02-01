const mysql = require('mysql2');
const fs = require('fs');














const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'rpecojourney'
  });

// Test on startup
db.connect((err) => {
  if (err) {
    console.error('MySQL Connection failed:', err);
    return;
  }
  console.log('Connected to MySQL with SSL');
});

module.exports = db;