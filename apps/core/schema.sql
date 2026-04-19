-- Drops table - Main drop storage
CREATE TABLE IF NOT EXISTS drops (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  data TEXT,
  r2_key TEXT,
  visibility TEXT NOT NULL DEFAULT 'protected',
  salt TEXT NOT NULL,
  iv TEXT,
  encryption_algo TEXT NOT NULL DEFAULT 'pbkdf2-aes256-gcm-v1',
  encryption_params TEXT,
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  admin_hash TEXT NOT NULL,
  hash_algo TEXT NOT NULL DEFAULT 'sha-256',
  tier TEXT NOT NULL DEFAULT 'free',
  payment_status TEXT NOT NULL DEFAULT 'none',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Drop history table - Version history for drops
CREATE TABLE IF NOT EXISTS drop_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drop_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  data TEXT,
  r2_key TEXT,
  iv TEXT,
  encryption_algo TEXT,
  encryption_params TEXT,
  mime_type TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (drop_id) REFERENCES drops(id)
);

-- Audit log table - Tracks drop lifecycle events
CREATE TABLE IF NOT EXISTS drop_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drop_id TEXT NOT NULL,
  action TEXT NOT NULL,
  version INTEGER,
  created_at INTEGER NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_drops_expires_at ON drops(expires_at);
CREATE INDEX IF NOT EXISTS idx_drop_history_drop_id ON drop_history(drop_id);
CREATE INDEX IF NOT EXISTS idx_drop_audit_log_drop_id ON drop_audit_log(drop_id);
