import { getSyncQueue, removeSyncQueueItems, storeExperimentData } from '../db/offline-db';
import { api } from '../api/client';

interface SyncResult {
  id: string;
  success: boolean;
  error?: string;
  conflict?: boolean;
}

export interface SyncPushResult {
  total: number;
  succeeded: number;
  failed: number;
  conflicts: number;
  errors: string[];
}

export async function syncPendingMutations(): Promise<SyncPushResult> {
  const queue = await getSyncQueue();

  if (queue.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, conflicts: 0, errors: [] };
  }

  const mutations = queue.map((item: { id: string; type: string; payload: Record<string, unknown>; timestamp: number; experimentId: number }) => ({
    id: item.id,
    type: item.type,
    payload: item.payload,
    timestamp: item.timestamp,
  }));

  const results = await api.post<SyncResult[]>('/sync/push', { mutations });

  // Remove successful items from queue
  const successIds = results.filter(r => r.success).map(r => r.id);
  if (successIds.length > 0) {
    await removeSyncQueueItems(successIds);
  }

  // Re-download experiment data for affected experiments to get server-calculated fields
  const experimentIds = new Set(queue.map((item: { experimentId: number }) => item.experimentId));
  for (const expId of experimentIds) {
    try {
      const data = await api.get<{
        experiment: Record<string, unknown>;
        treatmentGroups: Record<string, unknown>[];
        subjects: Record<string, unknown>[];
        observations: Record<string, unknown>[];
        samples: Record<string, unknown>[];
        syncedAt: string;
      }>(`/sync/experiment/${expId}`);
      await storeExperimentData(data);
    } catch {
      // Non-fatal: offline cache may be slightly stale
    }
  }

  const conflicts = results.filter(r => r.conflict).length;
  const failed = results.filter(r => !r.success).length;
  const errors = results.filter(r => !r.success && r.error).map(r => r.error!);

  return {
    total: results.length,
    succeeded: successIds.length,
    failed,
    conflicts,
    errors,
  };
}

export async function downloadForOffline(experimentId: number) {
  const data = await api.get<{
    experiment: Record<string, unknown>;
    treatmentGroups: Record<string, unknown>[];
    subjects: Record<string, unknown>[];
    observations: Record<string, unknown>[];
    samples: Record<string, unknown>[];
    syncedAt: string;
  }>(`/sync/experiment/${experimentId}`);
  await storeExperimentData(data);
  return data;
}
