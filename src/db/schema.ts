/**
 * SQLite schema for hookdash.
 * All tables are created idempotently (IF NOT EXISTS).
 */
export const SCHEMA_SQL = `
-- Webhook sources / providers
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'generic',
  signing_secret TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Forwarding endpoints
CREATE TABLE IF NOT EXISTS endpoints (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  event_filter TEXT,
  headers TEXT,
  timeout_ms INTEGER DEFAULT 30000,
  max_retries INTEGER DEFAULT 8,
  active INTEGER DEFAULT 1,
  circuit_state TEXT DEFAULT 'closed',
  circuit_failure_count INTEGER DEFAULT 0,
  circuit_last_failure_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Incoming webhook events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  event_type TEXT,
  headers TEXT NOT NULL,
  body TEXT NOT NULL,
  content_type TEXT,
  signature_valid INTEGER,
  received_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_received ON events(received_at);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- Delivery attempts
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  endpoint_id TEXT NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  next_retry_at TEXT,
  last_status_code INTEGER,
  last_response_body TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_next_retry ON deliveries(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_event ON deliveries(event_id);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);
`;

export const CURRENT_SCHEMA_VERSION = 1;
