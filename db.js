// const mysql = require('mysql2');

// // Database connection details
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'rpecojourney'
//   });

// //Connecting to database
// db.connect((err) => {
//     if (err) {
//         console.error('Error connecting to MySQL:', err);
//         return;
//     }
//     console.log('Connected to MySQL database');
// });

// module.exports = db;

const { Pool } = require('pg');

const poolConfig = {
    max: 5,
    min: 2,
    idleTimeoutMillis: 600000,
};
const DataBase = process.env.PG_DATABASE;
const UserName = process.env.PG_USER;
const Password = process.env.PG_PASSWORD;
const Host = process.env.PG_HOST;
const Port = process.env.PG_PORT;

poolConfig.connectionString = `postgresql://${UserName}:${Password}@${Host}:${Port}/${DataBase}`;

const client = new Pool(poolConfig);