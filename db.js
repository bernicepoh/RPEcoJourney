const mysql = require('mysql2');
const fs = require('fs');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_CA ? { ca: fs.readFileSync(process.env.DB_CA) } : undefined
});


db.connect((err) => {
  if (err) {
    console.error('MySQL Connection failed:', err);
    return;
  }
  console.log('Connected to MySQL with SSL');
});

module.exports = db;