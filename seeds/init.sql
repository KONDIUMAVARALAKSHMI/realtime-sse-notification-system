-- Create tables
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    channel VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_channel_id ON events(channel, id);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id INTEGER NOT NULL,
    channel VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(user_id, channel)
);

-- Seed data
-- Users are conceptual in user_subscriptions, but we'll ensure they are represented in the subscriptions logic

-- Insert sample subscriptions
INSERT INTO user_subscriptions (user_id, channel) VALUES 
(1, 'alerts'),
(1, 'updates'),
(2, 'alerts');

-- Insert sample events
INSERT INTO events (channel, event_type, payload) VALUES 
('alerts', 'system_maintenance', '{"message": "System check in 2 hours", "severity": "low"}'),
('updates', 'price_change', '{"symbol": "BTC", "price": 50000}'),
('alerts', 'critical_error', '{"error": "Database connection unstable", "severity": "high"}');
