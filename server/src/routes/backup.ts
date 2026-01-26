import { Router } from 'express';
import { getBackupStatus, getBackupHistory, performBackup } from '../services/backup.js';
import { getIntegrityStatus, getIntegrityHistory, runIntegrityCheck } from '../services/integrity.js';
import type { ApiResponse } from '@lab-data-manager/shared';

export const backupRouter = Router();

// GET /api/backup/status - Get current backup configuration and status (includes integrity)
backupRouter.get('/status', (_req, res) => {
  const status = getBackupStatus();
  const integrity = getIntegrityStatus();
  const response: ApiResponse<typeof status & { integrity: typeof integrity }> = {
    success: true,
    data: { ...status, integrity },
  };
  res.json(response);
});

// GET /api/backup/history - Get backup history
backupRouter.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit as string || '30', 10);
  const history = getBackupHistory(limit);
  const response: ApiResponse<typeof history> = { success: true, data: history };
  res.json(response);
});

// POST /api/backup/trigger - Manually trigger a backup
backupRouter.post('/trigger', async (_req, res) => {
  try {
    console.log('Manual backup triggered via API');
    const result = await performBackup();

    if (result.success) {
      const response: ApiResponse<typeof result> = { success: true, data: result };
      res.json(response);
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Backup failed',
        data: result,
      });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// GET /api/backup/integrity - Get integrity check history
backupRouter.get('/integrity', (req, res) => {
  const limit = parseInt(req.query.limit as string || '30', 10);
  const history = getIntegrityHistory(limit);
  const response: ApiResponse<typeof history> = { success: true, data: history };
  res.json(response);
});

// POST /api/backup/integrity/check - Manually trigger an integrity check
backupRouter.post('/integrity/check', (_req, res) => {
  console.log('Manual integrity check triggered via API');
  const result = runIntegrityCheck();
  const response: ApiResponse<typeof result> = { success: true, data: result };
  res.json(response);
});
