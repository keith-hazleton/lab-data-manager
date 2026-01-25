import { api } from './client';
import type {
  Experiment,
  ExperimentSummary,
  ExperimentWithGroups,
  CreateExperimentInput,
  UpdateExperimentInput,
  TreatmentGroup,
  CreateTreatmentGroupInput,
  UpdateTreatmentGroupInput,
  ProtocolTimepoint,
  CreateProtocolTimepointInput,
  UpdateProtocolTimepointInput,
} from '@lab-data-manager/shared';

export const experimentsApi = {
  list: () => api.get<ExperimentSummary[]>('/experiments'),

  get: (id: number) => api.get<ExperimentWithGroups>(`/experiments/${id}`),

  create: (input: CreateExperimentInput) =>
    api.post<Experiment>('/experiments', input),

  update: (id: number, input: UpdateExperimentInput) =>
    api.put<Experiment>(`/experiments/${id}`, input),

  delete: (id: number) => api.delete(`/experiments/${id}`),

  // Treatment groups
  getGroups: (experimentId: number) =>
    api.get<TreatmentGroup[]>(`/experiments/${experimentId}/groups`),

  createGroup: (experimentId: number, input: Omit<CreateTreatmentGroupInput, 'experiment_id'>) =>
    api.post<TreatmentGroup>(`/experiments/${experimentId}/groups`, input),

  updateGroup: (experimentId: number, groupId: number, input: UpdateTreatmentGroupInput) =>
    api.put<TreatmentGroup>(`/experiments/${experimentId}/groups/${groupId}`, input),

  deleteGroup: (experimentId: number, groupId: number) =>
    api.delete(`/experiments/${experimentId}/groups/${groupId}`),

  // Protocol timepoints
  getTimepoints: (experimentId: number) =>
    api.get<ProtocolTimepoint[]>(`/experiments/${experimentId}/timepoints`),

  createTimepoint: (experimentId: number, input: Omit<CreateProtocolTimepointInput, 'experiment_id'>) =>
    api.post<ProtocolTimepoint>(`/experiments/${experimentId}/timepoints`, input),

  updateTimepoint: (experimentId: number, timepointId: number, input: UpdateProtocolTimepointInput) =>
    api.put<ProtocolTimepoint>(`/experiments/${experimentId}/timepoints/${timepointId}`, input),

  deleteTimepoint: (experimentId: number, timepointId: number) =>
    api.delete(`/experiments/${experimentId}/timepoints/${timepointId}`),
};
