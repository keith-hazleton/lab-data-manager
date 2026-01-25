import { api } from './client';
import type {
  Sample,
  CreateSampleInput,
  UpdateSampleInput,
  BatchCreateSamplesInput,
  SampleWithSubject,
  GlobalSampleWithSubject,
  AssayResult,
  CreateAssayResultInput,
  UpdateAssayResultInput,
} from '@lab-data-manager/shared';

export interface GlobalSamplesFilters {
  experiment_ids?: number[];
  sample_types?: string[];
  storage_status?: 'all' | 'stored' | 'unstored';
}

export const samplesApi = {
  listBySubject: (subjectId: number) =>
    api.get<Sample[]>(`/samples?subject_id=${subjectId}`),

  listByExperiment: (experimentId: number, sampleType?: string) => {
    const params = new URLSearchParams({ experiment_id: String(experimentId) });
    if (sampleType) params.append('sample_type', sampleType);
    return api.get<SampleWithSubject[]>(`/samples?${params}`);
  },

  listGlobal: (filters?: GlobalSamplesFilters) => {
    const params = new URLSearchParams();
    if (filters?.experiment_ids?.length) {
      params.append('experiment_ids', filters.experiment_ids.join(','));
    }
    if (filters?.sample_types?.length) {
      params.append('sample_types', filters.sample_types.join(','));
    }
    if (filters?.storage_status && filters.storage_status !== 'all') {
      params.append('storage_status', filters.storage_status);
    }
    const queryString = params.toString();
    return api.get<GlobalSampleWithSubject[]>(`/samples/global${queryString ? `?${queryString}` : ''}`);
  },

  get: (id: number) => api.get<Sample>(`/samples/${id}`),

  create: (input: CreateSampleInput) =>
    api.post<Sample>('/samples', input),

  createBatch: (input: BatchCreateSamplesInput) =>
    api.post<Sample[]>('/samples/batch', input),

  update: (id: number, input: UpdateSampleInput) =>
    api.put<Sample>(`/samples/${id}`, input),

  assignToStorage: (id: number, storageBoxId: number) =>
    api.put<Sample>(`/samples/${id}`, { storage_box_id: storageBoxId, box_position: null }),

  batchAssignToStorage: (sampleIds: number[], storageBoxId: number) =>
    api.put<void>('/samples/batch-assign', { sample_ids: sampleIds, storage_box_id: storageBoxId }),

  batchRemoveFromStorage: (sampleIds: number[]) =>
    api.put<void>('/samples/batch-assign', { sample_ids: sampleIds, storage_box_id: null }),

  removeFromStorage: (id: number) =>
    api.put<Sample>(`/samples/${id}`, { storage_box_id: null, box_position: null }),

  delete: (id: number) => api.delete(`/samples/${id}`),

  // Assay results
  getAssays: (sampleId: number) =>
    api.get<AssayResult[]>(`/samples/${sampleId}/assays`),

  createAssay: (sampleId: number, input: Omit<CreateAssayResultInput, 'sample_id'>) =>
    api.post<AssayResult>(`/samples/${sampleId}/assays`, input),

  updateAssay: (sampleId: number, assayId: number, input: UpdateAssayResultInput) =>
    api.put<AssayResult>(`/samples/${sampleId}/assays/${assayId}`, input),

  deleteAssay: (sampleId: number, assayId: number) =>
    api.delete(`/samples/${sampleId}/assays/${assayId}`),
};
