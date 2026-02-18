const express = require('express');
const bodyParser = require('body-parser');
const eventRoutes = require('./routes/events');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/events', eventRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
