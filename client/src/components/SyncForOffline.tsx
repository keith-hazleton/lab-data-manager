import { useState } from 'react';
import { Button } from './common/Button';
import { getSyncMeta } from '../db/offline-db';
import { downloadForOffline } from '../services/sync-manager';
import { useQuery } from '@tanstack/react-query';

interface SyncForOfflineProps {
  experimentId: number;
}

export function SyncForOffline({ experimentId }: SyncForOfflineProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: syncMeta, refetch } = useQuery({
    queryKey: ['syncMeta', experimentId],
    queryFn: () => getSyncMeta(experimentId),
  });

  const handleSync = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      await downloadForOffline(experimentId);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleSync}
        loading={isDownloading}
      >
        {syncMeta ? 'Re-sync' : 'Sync for Offline'}
      </Button>
      {syncMeta && (
        <span className="text-xs text-gray-500">
          {syncMeta.subjectCount} mice, synced {formatTime(syncMeta.lastSync)}
        </span>
      )}
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
