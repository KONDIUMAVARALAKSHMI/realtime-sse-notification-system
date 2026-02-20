const { Pool } = require('pg');
require('dotenv').config();

// Configure the connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // max number of clients in the pool
    idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // how long to wait before timing out when connecting a new client
});

pool.on('connect', client => {
    client.query('SELECT NOW()', (err, result) => {
        // In a 'connect' event, the client is already connected.
        // We don't need to call client.release() here as it's not a client acquired via pool.connect().
        // The client will be managed by the pool.
        if (err) {
            return console.error('Error executing test query on new client connection', err.stack);
        }
        console.log('Database client connected and tested successfully');
    });
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
