/**
 * D1-compatible adapter using better-sqlite3 for local development
 * Wraps better-sqlite3 to match Cloudflare D1 API exactly
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
 * D1-style statement
 */
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1StatementResult>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[][]>;
}

/**
 * D1-style prepared statement result
 */
interface D1StatementResult {
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
 * D1-style prepared statement implementation
 */
class D1PreparedStatement implements D1Statement {
  private stmt: Database.Statement;
  private boundValues: unknown[] = [];

  constructor(stmt: Database.Statement) {
    this.stmt = stmt;
  }

  bind(...values: unknown[]): D1Statement {
    this.boundValues = values;
    return this;
  }

  async first<T = unknown>(): Promise<T | null> {
    const result = this.stmt.get(...this.boundValues) as T | undefined;
    this.boundValues = [];
    return result ?? null;
  }

  async run(): Promise<D1StatementResult> {
    const start = Date.now();
    const info = this.stmt.run(...this.boundValues);
    this.boundValues = [];
    return {
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
    const results = this.stmt.all(...this.boundValues) as T[];
    this.boundValues = [];
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
    const results = this.stmt.all(...this.boundValues) as T[];
    this.boundValues = [];
    if (results.length === 0) return [];
    const keys = Object.keys(results[0] as Record<string, unknown>);
    return results.map((row) => keys.map((k) => (row as Record<string, unknown>)[k])) as T[][];
  }
}

/**
 * D1-style batch result
 */
interface D1BatchResult<T> {
  results: D1Result<T>[];
}

/**
 * D1 Database implementation using better-sqlite3
 */
class D1DatabaseImpl {
  private db: Database.Database;

  constructor(dbPath: string, schemaPath?: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');

    if (schemaPath) {
      if (!existsSync(dbPath)) {
        const schema = readFileSync(schemaPath, 'utf-8');
        this.db.exec(schema);
      } else {
        // Always run schema to ensure tables exist (uses IF NOT EXISTS)
        const schema = readFileSync(schemaPath, 'utf-8');
        this.db.exec(schema);
      }
    }
  }

  prepare(sql: string): D1Statement {
    const stmt = this.db.prepare(sql);
    return new D1PreparedStatement(stmt);
  }

  async batch<T = unknown>(statements: D1Statement[]): Promise<D1BatchResult<T>> {
    // Batch expects already-bound statements
    // Execute each statement and collect results
    const results: (D1Result<T> | D1StatementResult)[] = [];

    for (const stmt of statements) {
      // Try calling all() first (for SELECT queries)
      try {
        const allResult = await stmt.all<T>();
        results.push(allResult);
      } catch {
        // If all() fails, try run() (for INSERT/UPDATE/DELETE)
        const runResult = await stmt.run();
        results.push(runResult);
      }
    }

    return { results } as D1BatchResult<T>;
  }

  async exec(sql: string): Promise<D1Result<unknown>> {
    const start = Date.now();
    this.db.exec(sql);
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

  close(): void {
    this.db.close();
  }
}

/**
 * Type assertion to make this compatible with D1Database
 */
export type D1Database = D1DatabaseImpl & {
  // D1 has these at runtime
  prepare(sql: string): D1Statement;
  batch<T>(statements: D1Statement[]): Promise<D1BatchResult<T>>;
  exec(sql: string): Promise<D1Result<unknown>>;
};

/**
 * Create a D1-compatible database for local development
 */
export function createLocalD1Database(dbPath: string, schemaPath?: string): D1Database {
  return new D1DatabaseImpl(dbPath, schemaPath) as D1Database;
}
