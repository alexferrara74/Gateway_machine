import mysql from 'mysql2/promise';
import { config } from './config.js';

const dbLocal = mysql.createPool({
    host: config.dbLocal.host,
    user: config.dbLocal.user,
    password: config.dbLocal.password,
    database: config.dbLocal.database,
    port: config.dbLocal.port,
    waitForConnections: true,
    connectionLimit: config.dbLocal.connectionLimit,
    queueLimit: 0
});

export default dbLocal;