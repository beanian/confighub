import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Get the project root (2 levels up from src/db/)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DB_PATH = process.env.DATABASE_PATH || path.join(PROJECT_ROOT, 'data', 'confighub.db');

let db: Database | null = null;

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  return db;
}

export function saveDb(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

export async function initializeDatabase(): Promise<void> {
  const database = await getDb();

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  database.run(schema);

  // Run migrations for existing databases
  runMigrations(database);

  // Seed admin user if not exists
  const result = database.exec('SELECT id FROM users WHERE email = ?', ['admin@confighub.local']);
  const adminExists = result.length > 0 && result[0].values.length > 0;

  if (!adminExists) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    database.run(`
      INSERT INTO users (id, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), 'admin@confighub.local', passwordHash, 'admin']);

    console.log('Created default admin user: admin@confighub.local / admin123');
  }

  saveDb();
}

function runMigrations(database: Database): void {
  // Check if 'operation' column exists in change_requests
  const tableInfo = database.exec("PRAGMA table_info(change_requests)");
  if (tableInfo.length > 0) {
    const columns = tableInfo[0].values.map((row) => row[1]);

    // Add 'operation' column if it doesn't exist
    if (!columns.includes('operation')) {
      console.log('Running migration: adding operation column to change_requests');
      database.run("ALTER TABLE change_requests ADD COLUMN operation TEXT DEFAULT 'update'");
    }
  }

  // Check if audit_log needs migration (old schema had different columns)
  const auditInfo = database.exec("PRAGMA table_info(audit_log)");
  if (auditInfo.length > 0) {
    const columns = auditInfo[0].values.map((row) => row[1]);

    // If old schema (has user_id instead of actor), recreate table
    if (columns.includes('user_id') && !columns.includes('actor')) {
      console.log('Running migration: recreating audit_log table with new schema');
      database.run("DROP TABLE IF EXISTS audit_log");
      database.run(`
        CREATE TABLE audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          actor TEXT NOT NULL,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          environment TEXT,
          domain TEXT,
          details TEXT,
          commit_sha TEXT
        )
      `);
    }
  }

  // Check if promotion_requests table exists
  const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='promotion_requests'");
  if (tables.length === 0 || tables[0].values.length === 0) {
    console.log('Running migration: creating promotion_requests table');
    database.run(`
      CREATE TABLE IF NOT EXISTS promotion_requests (
        id TEXT PRIMARY KEY,
        source_env TEXT NOT NULL,
        target_env TEXT NOT NULL,
        domain TEXT NOT NULL,
        files TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'promoted', 'failed', 'rolled_back')),
        requested_by TEXT NOT NULL,
        requested_at TEXT NOT NULL DEFAULT (datetime('now')),
        reviewed_by TEXT,
        reviewed_at TEXT,
        promoted_at TEXT,
        commit_sha TEXT,
        notes TEXT,
        review_notes TEXT,
        FOREIGN KEY (requested_by) REFERENCES users(id),
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      )
    `);
  }
}

// Helper functions for common operations
export async function dbRun(sql: string, params: unknown[] = []): Promise<void> {
  const database = await getDb();
  database.run(sql, params as (string | number | Uint8Array | null)[]);
  saveDb();
}

export async function dbGet<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const database = await getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params as (string | number | Uint8Array | null)[]);

  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    stmt.free();

    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return row as T;
  }

  stmt.free();
  return undefined;
}

export async function dbAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const database = await getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params as (string | number | Uint8Array | null)[]);

  const rows: T[] = [];
  const columns = stmt.getColumnNames();

  while (stmt.step()) {
    const values = stmt.get();
    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    rows.push(row as T);
  }

  stmt.free();
  return rows;
}
