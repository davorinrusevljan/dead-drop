-- Add hash_algo column to drops table (v1.1+ future-proofing)
-- This field enables algorithm upgrades for auth hashing
-- Default to 'sha-256' which is the current algorithm

ALTER TABLE drops ADD COLUMN hash_algo TEXT DEFAULT 'sha-256' NOT NULL;

-- Rollback SQL for reverting this migration:
-- ALTER TABLE drops DROP COLUMN hash_algo;
