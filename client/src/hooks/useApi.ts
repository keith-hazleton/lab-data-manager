import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { experimentsApi, subjectsApi, observationsApi, samplesApi, storageApi, plotsApi } from '../api';
import type { AggregateMode } from '@lab-data-manager/shared';
import type {
  CreateExperimentInput,
  UpdateExperimentInput,
  CreateSubjectInput,
  BatchCreateSubjectsInput,
  UpdateSubjectInput,
  RecordExitInput,
  CreateObservationInput,
  BatchCreateObservationsInput,
  CreateSampleInput,
  BatchCreateSamplesInput,
  CreateFreezerInput,
  CreateStorageBoxInput,
  UpdateFreezerInput,
  UpdateStorageBoxInput,
} from '@lab-data-manager/shared';

// Experiments
export function useExperiments() {
  return useQuery({
    queryKey: ['experiments'],
    queryFn: experimentsApi.list,
  });
}

export function useExperiment(id: number) {
  return useQuery({
    queryKey: ['experiments', id],
    queryFn: () => experimentsApi.get(id),
    enabled: id > 0,
  });
}

export function useCreateExperiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExperimentInput) => experimentsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}

export function useUpdateExperiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateExperimentInput }) =>
      experimentsApi.update(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      queryClient.invalidateQueries({ queryKey: ['experiments', id] });
    },
  });
}

export function useDeleteExperiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => experimentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}

// Subjects
export function useSubjects(experimentId: number, options?: { status?: string; cage_number?: string; alive_on_date?: string; observation_date?: string }) {
  return useQuery({
    queryKey: ['subjects', experimentId, options],
    queryFn: () => subjectsApi.list(experimentId, options),
    enabled: experimentId > 0,
  });
}

export function useCages(experimentId: number) {
  return useQuery({
    queryKey: ['cages', experimentId],
    queryFn: () => subjectsApi.getCages(experimentId),
    enabled: experimentId > 0,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubjectInput) => subjectsApi.create(input),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['subjects', input.experiment_id] });
      queryClient.invalidateQueries({ queryKey: ['cages', input.experiment_id] });
    },
  });
}

export function useCreateSubjectsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BatchCreateSubjectsInput) => subjectsApi.createBatch(input),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['subjects', input.experiment_id] });
      queryClient.invalidateQueries({ queryKey: ['cages', input.experiment_id] });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateSubjectInput }) =>
      subjectsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['cages'] });
    },
  });
}

export function useRecordExit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RecordExitInput }) =>
      subjectsApi.recordExit(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['cages'] });
    },
  });
}

export function useDeleteCage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ experimentId, cageNumber }: { experimentId: number; cageNumber: string }) =>
      subjectsApi.deleteCage(experimentId, cageNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['cages'] });
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}

export function useUpdateCage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ experimentId, cageNumber, input }: {
      experimentId: number;
      cageNumber: string;
      input: { new_cage_number?: string; treatment_group_id?: number; diet?: string };
    }) => subjectsApi.updateCage(experimentId, cageNumber, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['cages'] });
    },
  });
}

// Observations
export function useObservations(experimentId: number, date?: string) {
  return useQuery({
    queryKey: ['observations', experimentId, date],
    queryFn: () => observationsApi.listByExperiment(experimentId, { date }),
    enabled: experimentId > 0 && (date !== undefined),
  });
}

export function useObservationsSummary(experimentId: number) {
  return useQuery({
    queryKey: ['observations', 'summary', experimentId],
    queryFn: () => observationsApi.getSummary(experimentId),
    enabled: experimentId > 0,
  });
}

export function useObservationAlerts(experimentId: number, date?: string) {
  return useQuery({
    queryKey: ['observations', 'alerts', experimentId, date],
    queryFn: () => observationsApi.getAlerts(experimentId, date),
    enabled: experimentId > 0,
  });
}

export function useCreateObservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateObservationInput) => observationsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observations'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['cages'] });
    },
  });
}

export function useCreateObservationsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BatchCreateObservationsInput) => observationsApi.createBatch(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observations'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['cages'] });
    },
  });
}

// Samples
export function useSamples(experimentId: number) {
  return useQuery({
    queryKey: ['samples', experimentId],
    queryFn: () => samplesApi.listByExperiment(experimentId),
    enabled: experimentId > 0,
  });
}

export function useGlobalSamples(filters?: { experiment_ids?: number[]; sample_types?: string[]; storage_status?: 'all' | 'stored' | 'unstored' }) {
  return useQuery({
    queryKey: ['samples', 'global', filters],
    queryFn: () => samplesApi.listGlobal(filters),
  });
}

export function useCreateSample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSampleInput) => samplesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    },
  });
}

export function useCreateSamplesBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BatchCreateSamplesInput) => samplesApi.createBatch(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    },
  });
}

// Storage
export function useFreezers() {
  return useQuery({
    queryKey: ['freezers'],
    queryFn: storageApi.listFreezers,
  });
}

export function useStorageBoxes(freezerId?: number) {
  return useQuery({
    queryKey: ['boxes', freezerId],
    queryFn: () => storageApi.listBoxes(freezerId),
  });
}

export function useBoxGrid(boxId: number) {
  return useQuery({
    queryKey: ['boxes', boxId, 'grid'],
    queryFn: () => storageApi.getBoxGrid(boxId),
    enabled: boxId > 0,
  });
}

export function useBoxDetails(boxId: number) {
  return useQuery({
    queryKey: ['boxes', boxId, 'details'],
    queryFn: () => storageApi.getBox(boxId),
    enabled: boxId > 0,
  });
}

export function useCreateFreezer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFreezerInput) => storageApi.createFreezer(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freezers'] });
    },
  });
}

export function useCreateStorageBox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStorageBoxInput) => storageApi.createBox(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freezers'] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
    },
  });
}

export function useUpdateFreezer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateFreezerInput }) =>
      storageApi.updateFreezer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freezers'] });
    },
  });
}

export function useUpdateStorageBox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateStorageBoxInput }) =>
      storageApi.updateBox(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freezers'] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
    },
  });
}

// Plots
export function useUnifiedTreatmentGroups(experimentIds: number[]) {
  return useQuery({
    queryKey: ['plots', 'treatment-groups', experimentIds],
    queryFn: () => plotsApi.getTreatmentGroups(experimentIds),
    enabled: experimentIds.length > 0,
  });
}

export function useSurvivalData(experimentIds: number[]) {
  return useQuery({
    queryKey: ['plots', 'survival', experimentIds],
    queryFn: () => plotsApi.getSurvivalData(experimentIds),
    enabled: experimentIds.length > 0,
  });
}

export function useWeightData(experimentIds: number[], aggregate: AggregateMode = 'median') {
  return useQuery({
    queryKey: ['plots', 'weight', experimentIds, aggregate],
    queryFn: () => plotsApi.getWeightData(experimentIds, aggregate),
    enabled: experimentIds.length > 0,
  });
}

export function useCssData(experimentIds: number[], aggregate: AggregateMode = 'median') {
  return useQuery({
    queryKey: ['plots', 'css', experimentIds, aggregate],
    queryFn: () => plotsApi.getCssData(experimentIds, aggregate),
    enabled: experimentIds.length > 0,
  });
}
