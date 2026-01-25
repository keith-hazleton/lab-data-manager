import { api } from './client';
import type {
  Observation,
  ObservationResponse,
  CreateObservationInput,
  UpdateObservationInput,
  BatchCreateObservationsInput,
  ObservationWithSubject,
  DailyObservationSummary,
} from '@lab-data-manager/shared';

export interface ObservationWithAlert extends ObservationWithSubject {
  baseline_weight: number | null;
  treatment_group_color: string | null;
  alert_reasons: string[];
}

export const observationsApi = {
  listBySubject: (subjectId: number, date?: string) => {
    const params = new URLSearchParams({ subject_id: String(subjectId) });
    if (date) params.append('date', date);
    return api.get<Observation[]>(`/observations?${params}`);
  },

  listByExperiment: (
    experimentId: number,
    options?: { date?: string; start_date?: string; end_date?: string }
  ) => {
    const params = new URLSearchParams({ experiment_id: String(experimentId) });
    if (options?.date) params.append('date', options.date);
    if (options?.start_date) params.append('start_date', options.start_date);
    if (options?.end_date) params.append('end_date', options.end_date);
    return api.get<ObservationWithSubject[]>(`/observations?${params}`);
  },

  getSummary: (experimentId: number, days = 7) =>
    api.get<DailyObservationSummary[]>(
      `/observations/summary?experiment_id=${experimentId}&days=${days}`
    ),

  getAlerts: (experimentId: number, date?: string) => {
    const params = new URLSearchParams({ experiment_id: String(experimentId) });
    if (date) params.append('date', date);
    return api.get<ObservationWithAlert[]>(`/observations/alerts?${params}`);
  },

  get: (id: number) => api.get<Observation>(`/observations/${id}`),

  create: (input: CreateObservationInput) =>
    api.post<ObservationResponse>('/observations', input),

  createBatch: (input: BatchCreateObservationsInput) =>
    api.post<ObservationResponse[]>('/observations/batch', input),

  update: (id: number, input: UpdateObservationInput) =>
    api.put<Observation>(`/observations/${id}`, input),

  delete: (id: number) => api.delete(`/observations/${id}`),
};
