const db = require('../db');

/**
 * SSEManager handles all Server-Sent Events connections.
 * It manages channel-based subscriptions, broadcasts events to listeners,
 * and handles event replaying for clients that reconnect.
 */
class SSEManager {
    LineContent: constructor() {
    this.connections = new Map(); // channel -> Set<Response>
    this.heartbeatInterval = 30000;
    this.startHeartbeat();
}

addConnection(channel, res) {
    if (!this.connections.has(channel)) {
        this.connections.set(channel, new Set());
    }
    this.connections.get(channel).add(res);
    console.log(`Connection added to channel: ${channel}. Total connections for channel: ${this.connections.get(channel).size}`);
}

removeConnection(channel, res) {
    const channelConnections = this.connections.get(channel);
    if (channelConnections) {
        channelConnections.delete(res);
        if (channelConnections.size === 0) {
            this.connections.delete(channel);
        }
        console.log(`Connection removed from channel: ${channel}`);
    }
}

broadcast(channel, event) {
    const channelConnections = this.connections.get(channel);
    if (channelConnections) {
        const data = `id: ${event.id}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
        channelConnections.forEach((res) => {
            res.write(data);
        });
    }
}

    async replayEvents(channels, lastEventId, res) {
    try {
        const channelArray = channels.split(',');
        const result = await db.query(
            'SELECT * FROM events WHERE id > $1 AND channel = ANY($2) ORDER BY id ASC',
            [lastEventId, channelArray]
        );

        for (const event of result.rows) {
            const data = `id: ${event.id}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
            res.write(data);
        }
    } catch (err) {
        console.error('Error during event replay:', err);
    }
}

getConnectionCount() {
    let count = 0;
    this.connections.forEach((clients) => {
        count += clients.size;
    });
    return count;
}

startHeartbeat() {
    setInterval(() => {
        const heartbeat = ': heartbeat\n\n';
        this.connections.forEach((clients) => {
            clients.forEach((res) => {
                res.write(heartbeat);
            });
        });
    }, this.heartbeatInterval);
}
}

module.exports = new SSEManager();
