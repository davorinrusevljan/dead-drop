-- Admin database schema (separate from core database)
-- This schema is for the admin_users table only

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- 'admin' | 'superadmin'
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at INTEGER
);

-- Backup history table - Tracks database backup operations
CREATE TABLE IF NOT EXISTS backup_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triggered_by INTEGER NOT NULL REFERENCES admin_users(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'complete' | 'failed'
  r2_key TEXT,                             -- R2 object key for the backup file
  r2_size_bytes INTEGER,                   -- Size of backup file in bytes
  cf_bookmark TEXT,                        -- Cloudflare export API polling bookmark
  cf_export_id TEXT,                       -- Cloudflare export job identifier
  error_message TEXT,                      -- Error details if status = 'failed'
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER                    -- When backup finished (success or failure)
);

-- Create initial superadmin (to be updated with real credentials)
-- Password should be set via bootstrap script
