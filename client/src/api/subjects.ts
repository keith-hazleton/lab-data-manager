import { api } from './client';
import type {
  Subject,
  CreateSubjectInput,
  UpdateSubjectInput,
  BatchCreateSubjectsInput,
  SubjectWithLatestObservation,
  CageGroup,
  RecordExitInput,
} from '@lab-data-manager/shared';

export const subjectsApi = {
  list: (experimentId: number, options?: { status?: string; cage_number?: string; alive_on_date?: string; observation_date?: string }) => {
    const params = new URLSearchParams({ experiment_id: String(experimentId) });
    if (options?.status) params.append('status', options.status);
    if (options?.cage_number) params.append('cage_number', options.cage_number);
    if (options?.alive_on_date) params.append('alive_on_date', options.alive_on_date);
    if (options?.observation_date) params.append('observation_date', options.observation_date);
    return api.get<SubjectWithLatestObservation[]>(`/subjects?${params}`);
  },

  getCages: (experimentId: number) =>
    api.get<CageGroup[]>(`/subjects/cages?experiment_id=${experimentId}`),

  get: (id: number) => api.get<Subject>(`/subjects/${id}`),

  create: (input: CreateSubjectInput) =>
    api.post<Subject>('/subjects', input),

  createBatch: (input: BatchCreateSubjectsInput) =>
    api.post<Subject[]>('/subjects/batch', input),

  update: (id: number, input: UpdateSubjectInput) =>
    api.put<Subject>(`/subjects/${id}`, input),

  recordExit: (id: number, input: RecordExitInput) =>
    api.post<Subject>(`/subjects/${id}/exit`, input),

  delete: (id: number) => api.delete(`/subjects/${id}`),

  deleteCage: (experimentId: number, cageNumber: string) =>
    api.delete(`/subjects/cage/${experimentId}/${encodeURIComponent(cageNumber)}`),

  updateCage: (experimentId: number, cageNumber: string, input: { new_cage_number?: string; treatment_group_id?: number; diet?: string }) =>
    api.put<Subject[]>(`/subjects/cage/${experimentId}/${encodeURIComponent(cageNumber)}`, input),
};
