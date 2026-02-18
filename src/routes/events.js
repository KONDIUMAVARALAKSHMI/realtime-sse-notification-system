const express = require('express');
const router = express.Router();
const db = require('../db');
const sseManager = require('../services/sseManager');

// POST /api/events/publish
router.post('/publish', async (req, res) => {
    const { channel, eventType, payload } = req.body;

    if (!channel || !eventType || !payload) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await db.query(
            'INSERT INTO events (channel, event_type, payload) VALUES ($1, $2, $3) RETURNING *',
            [channel, eventType, payload]
        );

        const savedEvent = result.rows[0];
        sseManager.broadcast(channel, savedEvent);

        // Requirement 5: Success Response (202 Accepted) - An empty body.
        return res.status(202).send();
    } catch (err) {
        console.error('Error publishing event:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events/channels/subscribe
router.post('/channels/subscribe', async (req, res) => {
    const { userId, channel } = req.body;

    if (!userId || !channel) {
        return res.status(400).json({ error: 'Missing userId or channel' });
    }

    try {
        await db.query(
            'INSERT INTO user_subscriptions (user_id, channel) VALUES ($1, $2) ON CONFLICT (user_id, channel) DO NOTHING',
            [userId, channel]
        );
        // Requirement 6: Success Response (201 Created)
        return res.status(201).json({
            status: 'subscribed',
            userId,
            channel
        });
    } catch (err) {
        console.error('Error subscribing:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events/channels/unsubscribe
router.post('/channels/unsubscribe', async (req, res) => {
    const { userId, channel } = req.body;

    if (!userId || !channel) {
        return res.status(400).json({ error: 'Missing userId or channel' });
    }

    try {
        const result = await db.query(
            'DELETE FROM user_subscriptions WHERE user_id = $1 AND channel = $2',
            [userId, channel]
        );

        // Requirement 7: Success Response (200 OK)
        return res.status(200).json({
            status: 'unsubscribed',
            userId,
            channel
        });
    } catch (err) {
        console.error('Error unsubscribing:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/events/channels/list
router.get('/channels/list', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    try {
        const result = await db.query(
            'SELECT channel FROM user_subscriptions WHERE user_id = $1',
            [userId]
        );
        return res.status(200).json({ channels: result.rows.map(r => r.channel) });
    } catch (err) {
        console.error('Error listing channels:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/events/active-connections
router.get('/active-connections', (req, res) => {
    res.status(200).json({ count: sseManager.getConnectionCount() });
});

// GET /api/events/stream
router.get('/stream', async (req, res) => {
    const { userId, channels } = req.query;

    if (!userId || !channels) {
        return res.status(400).json({ error: 'Missing userId or channels' });
    }

    const requestedChannels = channels.split(',');

    try {
        // Requirement 11: Validate user is subscribed to requested channels
        const result = await db.query(
            'SELECT channel FROM user_subscriptions WHERE user_id = $1 AND channel = ANY($2)',
            [userId, requestedChannels]
        );

        const subscribedChannels = result.rows.map((row) => row.channel);

        if (subscribedChannels.length === 0) {
            return res.status(403).json({ error: 'User is not subscribed to any of these channels' });
        }

        // Set headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });

        console.log(`Stream started for user: ${userId} on channels: ${channels}`);

        // Requirement 10: Replay support
        const lastEventId = req.headers['last-event-id'];
        if (lastEventId) {
            console.log(`Replaying events after ID: ${lastEventId} for user: ${userId}`);
            await sseManager.replayEvents(subscribedChannels.join(','), parseInt(lastEventId, 10), res);
        }

        // Add to active connections
        subscribedChannels.forEach((channel) => {
            sseManager.addConnection(channel, res);
        });

        // Remove from active connections on close
        req.on('close', () => {
            console.log(`Connection closed for user: ${userId}`);
            subscribedChannels.forEach((channel) => {
                sseManager.removeConnection(channel, res);
            });
            res.end();
        });
    } catch (err) {
        console.error('Error setting up stream:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/events/history
router.get('/history', async (req, res) => {
    const { channel, afterId, limit = 50 } = req.query;

    if (!channel) {
        return res.status(400).json({ error: 'Missing channel' });
    }

    try {
        let query = 'SELECT * FROM events WHERE channel = $1';
        const params = [channel];

        if (afterId) {
            query += ' AND id > $2';
            params.push(afterId);
        }

        query += ' ORDER BY id ASC LIMIT $' + (params.length + 1);
        params.push(parseInt(limit, 10));

        const result = await db.query(query, params);

        // Requirement 12: Success Response with camelCase keys
        const events = result.rows.map(row => ({
            id: parseInt(row.id),
            channel: row.channel,
            eventType: row.event_type,
            payload: row.payload,
            createdAt: row.created_at
        }));

        return res.status(200).json({ events });
    } catch (err) {
        console.error('Error fetching history:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
