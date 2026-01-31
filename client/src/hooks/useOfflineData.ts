import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import * as offlineDb from '../db/offline-db';
import { subjectsApi } from '../api/subjects';
import { observationsApi } from '../api/observations';
import { experimentsApi } from '../api/experiments';
import type { SubjectWithLatestObservation, CageGroup } from '@lab-data-manager/shared';

export function useOfflineExperiment(id: number) {
  const { isOnline } = useAppContext();

  return useQuery({
    queryKey: ['experiments', id, isOnline ? 'online' : 'offline'],
    queryFn: async () => {
      if (isOnline) {
        try {
          return await experimentsApi.get(id);
        } catch {
          // Fall back to offline
          const cached = await offlineDb.getExperiment(id);
          if (cached) {
            const tgs = await offlineDb.getTreatmentGroups(id);
            return { ...cached, treatment_groups: tgs } as Record<string, unknown>;
          }
          throw new Error('No cached data available');
        }
      }
      const cached = await offlineDb.getExperiment(id);
      if (!cached) throw new Error('No cached data available');
      const tgs = await offlineDb.getTreatmentGroups(id);
      return { ...cached, treatment_groups: tgs } as Record<string, unknown>;
    },
    enabled: id > 0,
  });
}

export function useOfflineSubjects(
  experimentId: number,
  options?: { status?: string; cage_number?: string; observation_date?: string }
) {
  const { isOnline } = useAppContext();

  return useQuery({
    queryKey: ['subjects', experimentId, options, isOnline ? 'online' : 'offline'],
    queryFn: async () => {
      if (isOnline) {
        try {
          return await subjectsApi.list(experimentId, options);
        } catch {
          return await offlineDb.getSubjectsWithLatestObs(experimentId, options) as unknown as SubjectWithLatestObservation[];
        }
      }
      return await offlineDb.getSubjectsWithLatestObs(experimentId, options) as unknown as SubjectWithLatestObservation[];
    },
    enabled: experimentId > 0,
  });
}

export function useOfflineCages(experimentId: number) {
  const { isOnline } = useAppContext();

  return useQuery({
    queryKey: ['cages', experimentId, isOnline ? 'online' : 'offline'],
    queryFn: async () => {
      if (isOnline) {
        try {
          return await subjectsApi.getCages(experimentId);
        } catch {
          return await offlineDb.getCages(experimentId) as unknown as CageGroup[];
        }
      }
      return await offlineDb.getCages(experimentId) as unknown as CageGroup[];
    },
    enabled: experimentId > 0,
  });
}

export function useOfflineObservations(experimentId: number, date?: string) {
  const { isOnline } = useAppContext();

  return useQuery({
    queryKey: ['observations', experimentId, date, isOnline ? 'online' : 'offline'],
    queryFn: async () => {
      if (isOnline) {
        try {
          return await observationsApi.listByExperiment(experimentId, { date });
        } catch {
          return await offlineDb.getObservations(experimentId, date);
        }
      }
      return await offlineDb.getObservations(experimentId, date);
    },
    enabled: experimentId > 0 && date !== undefined,
  });
}
