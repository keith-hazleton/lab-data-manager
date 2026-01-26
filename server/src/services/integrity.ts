import { getDatabase } from '../db/connection.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface IntegrityResult {
  ok: boolean;
  lastCheck: string;
  issues: string[];
  checkDurationMs: number;
}

interface IntegrityHistory {
  results: IntegrityResult[];
}

let schedulerTask: cron.ScheduledTask | null = null;
let lastIntegrityResult: IntegrityResult | null = null;

// Default schedule: 30 minutes after backup (2:30am)
const DEFAULT_SCHEDULE = process.env.INTEGRITY_CHECK_SCHEDULE || '30 2 * * *';

function getHistoryPath(): string {
  return join(__dirname, '../../../data/integrity-history.json');
}

function loadHistory(): IntegrityHistory {
  const historyPath = getHistoryPath();
  if (existsSync(historyPath)) {
    try {
      const content = readFileSync(historyPath, 'utf-8');
      return JSON.parse(content) as IntegrityHistory;
    } catch {
      console.error('Failed to load integrity history, starting fresh');
    }
  }
  return { results: [] };
}

function saveHistory(history: IntegrityHistory): void {
  const historyPath = getHistoryPath();
  const dataDir = dirname(historyPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

function addIntegrityRecord(result: IntegrityResult): void {
  const history = loadHistory();
  history.results.unshift(result);
  // Keep only the last 30 records
  history.results = history.results.slice(0, 30);
  saveHistory(history);
}

/**
 * Run SQLite integrity check on the database
 */
export function runIntegrityCheck(): IntegrityResult {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const issues: string[] = [];

  try {
    const db = getDatabase();

    // Run PRAGMA integrity_check
    // Returns 'ok' if database is valid, or list of issues
    const checkResult = db.pragma('integrity_check') as { integrity_check: string }[];

    for (const row of checkResult) {
      const value = row.integrity_check;
      if (value !== 'ok') {
        issues.push(value);
      }
    }

    // Also run quick_check for faster but less thorough validation
    const quickResult = db.pragma('quick_check') as { quick_check: string }[];
    for (const row of quickResult) {
      const value = row.quick_check;
      if (value !== 'ok' && !issues.includes(value)) {
        issues.push(`quick_check: ${value}`);
      }
    }

    // Run foreign_key_check
    const fkResult = db.pragma('foreign_key_check') as { table: string; rowid: number; parent: string; fkid: number }[];
    for (const row of fkResult) {
      issues.push(`Foreign key violation: ${row.table} row ${row.rowid} references missing ${row.parent}`);
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    issues.push(`Error running integrity check: ${errorMessage}`);
  }

  const result: IntegrityResult = {
    ok: issues.length === 0,
    lastCheck: timestamp,
    issues,
    checkDurationMs: Date.now() - startTime,
  };

  // Save to memory and history
  lastIntegrityResult = result;
  addIntegrityRecord(result);

  // Log result
  if (result.ok) {
    console.log(`Database integrity check passed (${result.checkDurationMs}ms)`);
  } else {
    console.error(`Database integrity check FAILED with ${issues.length} issue(s):`);
    issues.forEach(issue => console.error(`  - ${issue}`));
  }

  return result;
}

/**
 * Get the last integrity check result
 */
export function getIntegrityStatus(): IntegrityResult | null {
  if (lastIntegrityResult) {
    return lastIntegrityResult;
  }

  // Load from history if not in memory
  const history = loadHistory();
  if (history.results.length > 0) {
    lastIntegrityResult = history.results[0];
    return lastIntegrityResult;
  }

  return null;
}

/**
 * Get integrity check history
 */
export function getIntegrityHistory(limit: number = 30): IntegrityResult[] {
  const history = loadHistory();
  return history.results.slice(0, limit);
}

/**
 * Start the integrity check scheduler
 */
export function startIntegrityScheduler(schedule?: string): void {
  const cronSchedule = schedule || DEFAULT_SCHEDULE;

  if (!cron.validate(cronSchedule)) {
    console.error(`Invalid integrity check cron schedule: ${cronSchedule}`);
    return;
  }

  // Stop existing scheduler if running
  stopIntegrityScheduler();

  schedulerTask = cron.schedule(cronSchedule, () => {
    console.log(`Scheduled integrity check triggered at ${new Date().toISOString()}`);
    runIntegrityCheck();
  });

  console.log(`Integrity check scheduler started with schedule: ${cronSchedule}`);
}

/**
 * Stop the integrity check scheduler
 */
export function stopIntegrityScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('Integrity check scheduler stopped');
  }
}

/**
 * Run startup integrity check (quick check only for faster startup)
 */
export function runStartupIntegrityCheck(): IntegrityResult {
  console.log('Running startup integrity check...');
  return runIntegrityCheck();
}
