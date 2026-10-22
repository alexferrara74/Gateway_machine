import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbLocal = mysql.createPool({
    host: process.env.DB_NUOVO_HOST || 'localhost',
    user: process.env.DB_NUOVO_USER || 'root',
    password: process.env.DB_NUOVO_PASSWORD || 'root',
    database: process.env.DB_NUOVO_NAME || 'service',
    port: process.env.DB_NUOVO_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default dbLocal;