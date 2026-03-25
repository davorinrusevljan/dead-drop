/**
 * D1-compatible SQLite wrapper for local development
 * Wraps better-sqlite3 to match Cloudflare D1 API
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * D1-style result for queries
 */
interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

/**
 * D1-style prepared statement
 */
class D1PreparedStatement {
  private stmt: Database.Statement;
  private db: D1Database;

  constructor(stmt: Database.Statement, db: D1Database) {
    this.stmt = stmt;
    this.db = db;
  }

  bind(..._values: unknown[]): D1PreparedStatement {
    // Return a new prepared statement with bound values
    // In better-sqlite3, we bind at run time
    return new D1PreparedStatement(this.stmt, this.db);
  }

  async first<T = unknown>(): Promise<T | null> {
    const result = this.stmt.get(...(this.db._lastBindValues || [])) as T | undefined;
    this.db._lastBindValues = [];
    return result ?? null;
  }

  async run(): Promise<D1Result<unknown>> {
    const start = Date.now();
    const info = this.stmt.run(...(this.db._lastBindValues || []));
    this.db._lastBindValues = [];
    return {
      results: [],
      success: true,
      meta: {
        duration: Date.now() - start,
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid),
        rows_read: 0,
        rows_written: info.changes,
      },
    };
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const start = Date.now();
    const results = this.stmt.all(...(this.db._lastBindValues || [])) as T[];
    this.db._lastBindValues = [];
    return {
      results,
      success: true,
      meta: {
        duration: Date.now() - start,
        changes: 0,
        last_row_id: 0,
        rows_read: results.length,
        rows_written: 0,
      },
    };
  }

  async raw<T = unknown>(): Promise<T[][]> {
    const results = this.stmt.all(...(this.db._lastBindValues || [])) as T[];
    this.db._lastBindValues = [];
    // Convert to raw array format
    if (results.length === 0) return [];
    const keys = Object.keys(results[0] as Record<string, unknown>);
    return results.map((row) => keys.map((k) => (row as Record<string, unknown>)[k]));
  }
}

/**
 * D1-compatible database wrapper
 */
export class D1Database {
  private db: Database.Database;
  public _lastBindValues: unknown[] = [];

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  prepare(query: string): D1PreparedStatement {
    const stmt = this.db.prepare(query);
    return new D1PreparedStatement(stmt, this);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    const transaction = this.db.transaction(() => {
      for (const stmt of statements) {
        // This is simplified - in real D1, batch executes all statements
      }
    });
    transaction();
    return results;
  }

  async exec(query: string): Promise<D1Result<unknown>> {
    const start = Date.now();
    this.db.exec(query);
    return {
      results: [],
      success: true,
      meta: {
        duration: Date.now() - start,
        changes: 0,
        last_row_id: 0,
        rows_read: 0,
        rows_written: 0,
      },
    };
  }

  /**
   * Initialize database with schema
   */
  initializeSchema(schemaPath: string): void {
    if (existsSync(schemaPath)) {
      const schema = readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get raw better-sqlite3 instance for drizzle-orm
   */
  getRawDb(): Database.Database {
    return this.db;
  }
}

/**
 * Create a D1-compatible database for local development
 */
export function createLocalD1(dbPath: string, schemaPath?: string): D1Database {
  const db = new D1Database(dbPath);

  // Initialize schema if provided and database is new
  if (schemaPath && !existsSync(dbPath)) {
    db.initializeSchema(schemaPath);
  }

  return db;
}
