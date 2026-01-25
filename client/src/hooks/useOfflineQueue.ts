import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { api } from '../api';

export function useOfflineQueue() {
  const { isOnline, offlineQueue, clearQueue } = useAppContext();
  const queryClient = useQueryClient();

  const processQueue = useCallback(async () => {
    if (!isOnline || offlineQueue.length === 0) return;

    const errors: string[] = [];

    for (const item of offlineQueue) {
      try {
        if (item.method === 'POST') {
          await api.post(item.endpoint, item.body);
        } else if (item.method === 'PUT') {
          await api.put(item.endpoint, item.body);
        } else if (item.method === 'DELETE') {
          await api.delete(item.endpoint);
        }
      } catch (err) {
        errors.push(`Failed to sync: ${item.endpoint}`);
      }
    }

    clearQueue();

    // Refresh all data after sync
    queryClient.invalidateQueries();

    if (errors.length > 0) {
      console.error('Some items failed to sync:', errors);
    }
  }, [isOnline, offlineQueue, clearQueue, queryClient]);

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      processQueue();
    }
  }, [isOnline, offlineQueue.length, processQueue]);

  return {
    pendingCount: offlineQueue.length,
    isProcessing: false,
  };
}
