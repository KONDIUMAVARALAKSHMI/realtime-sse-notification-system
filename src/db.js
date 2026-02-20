const { Pool } = require('pg');
require('dotenv').config();

// Configure the connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // max number of clients in the pool
    idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // how long to wait before timing out when connecting a new client
});



pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
