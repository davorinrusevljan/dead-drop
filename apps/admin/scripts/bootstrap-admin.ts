/**
 * Bootstrap script for creating the first superadmin user
 * Usage: npx tsx scripts/bootstrap-admin.ts --username <username> --password <password>
 */

/* eslint-disable no-console */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateSalt } from '@dead-drop/engine';
import { hashPassword } from '../src/lib/password.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Args {
  username: string;
  password: string;
  database?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Partial<Args> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && args[i + 1]) {
      result.username = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      result.password = args[i + 1];
      i++;
    } else if (args[i] === '--database' && args[i + 1]) {
      result.database = args[i + 1];
      i++;
    }
  }

  if (!result.username || !result.password) {
    console.error(
      'Usage: npx tsx scripts/bootstrap-admin.ts --username <username> --password <password> [--database <path>]'
    );
    console.error('');
    console.error('Options:');
    console.error('  --username  Admin username (required)');
    console.error('  --password  Admin password (required, min 8 characters)');
    console.error(
      '  --database  Path to SQLite database (optional, defaults to .wrangler/state/admin.db)'
    );
    process.exit(1);
  }

  if (result.password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    process.exit(1);
  }

  return result as Args;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dbPath = args.database || join(__dirname, '../.wrangler/state/admin.db');
  const schemaPath = join(__dirname, '../schema.sql');

  console.log(`Creating superadmin user: ${args.username}`);
  console.log(`Database: ${dbPath}`);

  // Ensure directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
    console.log(`Created directory: ${dbDir}`);
  }

  // Open or create database
  const db = new Database(dbPath);

  // Apply schema if database is new
  if (!existsSync(dbPath)) {
    console.log('Applying schema...');
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  }

  // Check if table exists
  const tableCheck = db
    .prepare(
      `
    SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'
  `
    )
    .get();

  if (!tableCheck) {
    console.log('Creating admin_users table...');
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  }

  // Check if user already exists
  const existingUser = db
    .prepare('SELECT id FROM admin_users WHERE username = ?')
    .get(args.username);
  if (existingUser) {
    console.error(`Error: User "${args.username}" already exists`);
    db.close();
    process.exit(1);
  }

  // Generate salt and hash password
  const salt = generateSalt();
  const passwordHash = await hashPassword(args.password, salt);

  // Insert user
  const stmt = db.prepare(`
    INSERT INTO admin_users (username, password_hash, salt, role, created_at)
    VALUES (?, ?, ?, 'superadmin', unixepoch())
  `);

  stmt.run(args.username, passwordHash, salt);

  console.log('');
  console.log('✓ Superadmin user created successfully!');
  console.log('');
  console.log('You can now log in to the admin panel with:');
  console.log(`  Username: ${args.username}`);
  console.log(`  Password: ${'*'.repeat(args.password.length)}`);
  console.log('');

  db.close();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
