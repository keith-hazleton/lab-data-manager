import { getDatabase } from '../db/connection.js';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import cron from 'node-cron';

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration with defaults
export interface BackupConfig {
  enabled: boolean;
  backupDir: string;
  schedule: string;
  retentionDays: number;
  rcloneRemote: string | null;
  databasePath: string;
  gpgRecipient: string | null;
}

export interface BackupRecord {
  timestamp: string;
  filename: string;
  size: number;
  checksum: string;
  localPath: string;
  encrypted: boolean;
  cloudSynced: boolean;
  cloudError: string | null;
  success: boolean;
  error: string | null;
}

export interface BackupStatus {
  enabled: boolean;
  schedulerRunning: boolean;
  schedule: string;
  backupDir: string;
  gpgConfigured: boolean;
  gpgRecipient: string | null;
  rcloneConfigured: boolean;
  rcloneRemote: string | null;
  lastBackup: BackupRecord | null;
  nextScheduledRun: string | null;
}

interface BackupHistory {
  backups: BackupRecord[];
}

let schedulerTask: cron.ScheduledTask | null = null;
let currentConfig: BackupConfig | null = null;

function getDefaultConfig(): BackupConfig {
  const dataDir = join(__dirname, '../../../data');
  return {
    enabled: process.env.BACKUP_ENABLED !== 'false',
    backupDir: process.env.BACKUP_DIR || '/mnt/usb/lab-backups',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2am
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
    rcloneRemote: process.env.BACKUP_RCLONE_REMOTE || null,
    databasePath: process.env.DATABASE_PATH || join(dataDir, 'lab-data.db'),
    gpgRecipient: process.env.BACKUP_GPG_RECIPIENT || null,
  };
}

function getHistoryPath(): string {
  return join(__dirname, '../../../data/backup-history.json');
}

function loadHistory(): BackupHistory {
  const historyPath = getHistoryPath();
  if (existsSync(historyPath)) {
    try {
      const content = readFileSync(historyPath, 'utf-8');
      return JSON.parse(content) as BackupHistory;
    } catch {
      console.error('Failed to load backup history, starting fresh');
    }
  }
  return { backups: [] };
}

function saveHistory(history: BackupHistory): void {
  const historyPath = getHistoryPath();
  const dataDir = dirname(historyPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

function addBackupRecord(record: BackupRecord): void {
  const history = loadHistory();
  history.backups.unshift(record); // Add to beginning
  // Keep only the last 100 records
  history.backups = history.backups.slice(0, 100);
  saveHistory(history);
}

/**
 * Checkpoint the WAL file to ensure all pending writes are flushed
 */
export function checkpointDatabase(): void {
  const db = getDatabase();
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log('Database WAL checkpoint completed');
}

/**
 * Calculate SHA256 checksum of a file
 */
function calculateChecksum(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate a backup filename with timestamp
 */
function generateBackupFilename(encrypted: boolean): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', 'T');
  const ext = encrypted ? '.db.gpg' : '.db';
  return `lab-data-backup-${timestamp}${ext}`;
}

/**
 * Check if GPG is installed and the recipient key is available
 */
async function checkGpgAvailable(recipient: string): Promise<{ available: boolean; error: string | null }> {
  try {
    await execAsync('which gpg');
  } catch {
    return { available: false, error: 'gpg not installed' };
  }

  try {
    // Check if the recipient key exists
    await execAsync(`gpg --list-keys "${recipient}" 2>/dev/null`);
    return { available: true, error: null };
  } catch {
    return { available: false, error: `GPG key not found for recipient: ${recipient}` };
  }
}

/**
 * Encrypt a file using GPG
 */
async function encryptFile(inputPath: string, outputPath: string, recipient: string): Promise<{ success: boolean; error: string | null }> {
  try {
    // Encrypt with GPG - armor off for binary, always trust the key
    await execAsync(
      `gpg --encrypt --recipient "${recipient}" --trust-model always --output "${outputPath}" "${inputPath}"`,
      { timeout: 60000 } // 1 minute timeout
    );
    console.log(`File encrypted: ${outputPath}`);
    return { success: true, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Encryption failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync a local backup file to cloud using rclone
 */
async function syncToCloud(localPath: string, rcloneRemote: string): Promise<{ success: boolean; error: string | null }> {
  try {
    // Check if rclone is installed
    await execAsync('which rclone');
  } catch {
    return { success: false, error: 'rclone not installed' };
  }

  try {
    // Use rclone copy to upload the file
    await execAsync(`rclone copy "${localPath}" "${rcloneRemote}"`, {
      timeout: 300000, // 5 minute timeout
    });
    console.log(`Backup synced to cloud: ${rcloneRemote}`);
    return { success: true, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Cloud sync failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Apply retention policy - delete backups older than retentionDays
 */
export function applyRetentionPolicy(backupDir: string, retentionDays: number): number {
  if (!existsSync(backupDir)) {
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;
  const files = readdirSync(backupDir);

  for (const file of files) {
    // Match both encrypted (.db.gpg) and unencrypted (.db) backups
    if (!file.startsWith('lab-data-backup-') || (!file.endsWith('.db') && !file.endsWith('.db.gpg'))) {
      continue;
    }

    const filePath = join(backupDir, file);
    try {
      const stats = statSync(filePath);
      if (stats.mtime < cutoffDate) {
        unlinkSync(filePath);
        console.log(`Deleted old backup: ${file}`);
        deletedCount++;
      }
    } catch (err) {
      console.error(`Failed to check/delete ${file}:`, err);
    }
  }

  return deletedCount;
}

/**
 * Perform a full backup
 */
export async function performBackup(config?: Partial<BackupConfig>): Promise<BackupRecord> {
  const fullConfig = { ...getDefaultConfig(), ...config };
  const timestamp = new Date().toISOString();
  const willEncrypt = fullConfig.gpgRecipient !== null;
  const filename = generateBackupFilename(willEncrypt);

  const record: BackupRecord = {
    timestamp,
    filename,
    size: 0,
    checksum: '',
    localPath: '',
    encrypted: false,
    cloudSynced: false,
    cloudError: null,
    success: false,
    error: null,
  };

  let tempUnencryptedPath: string | null = null;

  try {
    // Step 1: Checkpoint the database
    console.log('Starting backup...');
    checkpointDatabase();

    // Step 2: Verify source database exists
    if (!existsSync(fullConfig.databasePath)) {
      throw new Error(`Database file not found: ${fullConfig.databasePath}`);
    }

    // Step 3: Create backup directory if it doesn't exist
    if (!existsSync(fullConfig.backupDir)) {
      mkdirSync(fullConfig.backupDir, { recursive: true });
      console.log(`Created backup directory: ${fullConfig.backupDir}`);
    }

    // Step 4: Copy database to backup location
    const finalBackupPath = join(fullConfig.backupDir, filename);

    if (willEncrypt && fullConfig.gpgRecipient) {
      // Check GPG availability first
      const gpgCheck = await checkGpgAvailable(fullConfig.gpgRecipient);
      if (!gpgCheck.available) {
        throw new Error(gpgCheck.error || 'GPG not available');
      }

      // Copy to temp location, then encrypt
      const unencryptedFilename = filename.replace('.db.gpg', '.db');
      tempUnencryptedPath = join(fullConfig.backupDir, `.temp-${unencryptedFilename}`);
      copyFileSync(fullConfig.databasePath, tempUnencryptedPath);
      console.log(`Temporary backup created: ${tempUnencryptedPath}`);

      // Encrypt the backup
      const encryptResult = await encryptFile(tempUnencryptedPath, finalBackupPath, fullConfig.gpgRecipient);
      if (!encryptResult.success) {
        throw new Error(encryptResult.error || 'Encryption failed');
      }

      record.encrypted = true;

      // Clean up temp file
      unlinkSync(tempUnencryptedPath);
      tempUnencryptedPath = null;
      console.log('Temporary unencrypted file removed');
    } else {
      // No encryption - just copy directly
      copyFileSync(fullConfig.databasePath, finalBackupPath);
      console.log(`Backup created: ${finalBackupPath}`);
    }

    // Step 5: Calculate checksum and size of final backup
    record.checksum = calculateChecksum(finalBackupPath);
    const stats = statSync(finalBackupPath);
    record.size = stats.size;
    record.localPath = finalBackupPath;
    record.success = true;

    console.log(`Backup checksum: ${record.checksum}`);
    console.log(`Backup size: ${(record.size / 1024 / 1024).toFixed(2)} MB`);
    if (record.encrypted) {
      console.log(`Backup encrypted for: ${fullConfig.gpgRecipient}`);
    }

    // Step 6: Sync to cloud if configured
    if (fullConfig.rcloneRemote) {
      const cloudResult = await syncToCloud(finalBackupPath, fullConfig.rcloneRemote);
      record.cloudSynced = cloudResult.success;
      record.cloudError = cloudResult.error;
    }

    // Step 7: Apply retention policy
    const deleted = applyRetentionPolicy(fullConfig.backupDir, fullConfig.retentionDays);
    if (deleted > 0) {
      console.log(`Retention policy: deleted ${deleted} old backup(s)`);
    }

    console.log('Backup completed successfully');
  } catch (err) {
    record.success = false;
    record.error = err instanceof Error ? err.message : 'Unknown error';
    console.error('Backup failed:', record.error);

    // Clean up temp file if it exists
    if (tempUnencryptedPath && existsSync(tempUnencryptedPath)) {
      try {
        unlinkSync(tempUnencryptedPath);
        console.log('Cleaned up temporary file after error');
      } catch {
        console.error('Failed to clean up temporary file');
      }
    }
  }

  // Save record to history
  addBackupRecord(record);

  return record;
}

/**
 * Get the next scheduled run time based on cron expression
 */
function getNextScheduledRun(schedule: string): string | null {
  // node-cron doesn't provide next run time, so we calculate it
  // This is a simplified calculation for common patterns
  const now = new Date();

  // Parse cron expression (minute hour day month weekday)
  const parts = schedule.split(' ');
  if (parts.length !== 5) {
    return null;
  }

  const [minute, hour] = parts;

  // For simple daily schedules like "0 2 * * *"
  if (!isNaN(parseInt(minute)) && !isNaN(parseInt(hour))) {
    const next = new Date(now);
    next.setHours(parseInt(hour), parseInt(minute), 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.toISOString();
  }

  return null;
}

/**
 * Start the backup scheduler
 */
export function startBackupScheduler(config?: Partial<BackupConfig>): void {
  const fullConfig = { ...getDefaultConfig(), ...config };
  currentConfig = fullConfig;

  if (!fullConfig.enabled) {
    console.log('Backup scheduler is disabled');
    return;
  }

  if (!cron.validate(fullConfig.schedule)) {
    console.error(`Invalid cron schedule: ${fullConfig.schedule}`);
    return;
  }

  // Stop existing scheduler if running
  stopBackupScheduler();

  schedulerTask = cron.schedule(fullConfig.schedule, async () => {
    console.log(`Scheduled backup triggered at ${new Date().toISOString()}`);
    await performBackup(fullConfig);
  });

  const nextRun = getNextScheduledRun(fullConfig.schedule);
  console.log(`Backup scheduler started with schedule: ${fullConfig.schedule}`);
  if (fullConfig.gpgRecipient) {
    console.log(`Backups will be encrypted for: ${fullConfig.gpgRecipient}`);
  }
  if (nextRun) {
    console.log(`Next backup scheduled for: ${nextRun}`);
  }
}

/**
 * Stop the backup scheduler
 */
export function stopBackupScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('Backup scheduler stopped');
  }
}

/**
 * Get current backup status
 */
export function getBackupStatus(): BackupStatus {
  const config = currentConfig || getDefaultConfig();
  const history = loadHistory();
  const lastBackup = history.backups.length > 0 ? history.backups[0] : null;

  return {
    enabled: config.enabled,
    schedulerRunning: schedulerTask !== null,
    schedule: config.schedule,
    backupDir: config.backupDir,
    gpgConfigured: config.gpgRecipient !== null,
    gpgRecipient: config.gpgRecipient,
    rcloneConfigured: config.rcloneRemote !== null,
    rcloneRemote: config.rcloneRemote,
    lastBackup,
    nextScheduledRun: schedulerTask ? getNextScheduledRun(config.schedule) : null,
  };
}

/**
 * Get backup history
 */
export function getBackupHistory(limit: number = 30): BackupRecord[] {
  const history = loadHistory();
  return history.backups.slice(0, limit);
}
