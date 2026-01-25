import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../../data/lab-data.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initializeDatabase(): void {
  const database = getDatabase();
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  database.exec(schema);

  // Run migrations for existing databases
  runMigrations(database);

  console.log('Database initialized successfully');
}

function runMigrations(database: Database.Database): void {
  // Check if diet column exists in subjects table
  const subjectColumns = database.prepare("PRAGMA table_info(subjects)").all() as { name: string }[];
  const hasDiet = subjectColumns.some(col => col.name === 'diet');

  if (!hasDiet) {
    database.exec('ALTER TABLE subjects ADD COLUMN diet TEXT');
    console.log('Migration: Added diet column to subjects table');
  }

  // Check if baseline_day_offset column exists in experiments table
  const expColumns = database.prepare("PRAGMA table_info(experiments)").all() as { name: string }[];
  const hasBaselineDay = expColumns.some(col => col.name === 'baseline_day_offset');

  if (!hasBaselineDay) {
    database.exec('ALTER TABLE experiments ADD COLUMN baseline_day_offset INTEGER NOT NULL DEFAULT 0');
    console.log('Migration: Added baseline_day_offset column to experiments table');
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
