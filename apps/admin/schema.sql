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

-- Create initial superadmin (to be updated with real credentials)
-- Password should be set via bootstrap script
