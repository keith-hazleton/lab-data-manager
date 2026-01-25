import { api } from './client';
import type {
  Freezer,
  CreateFreezerInput,
  UpdateFreezerInput,
  StorageBox,
  CreateStorageBoxInput,
  UpdateStorageBoxInput,
  StorageBoxWithSamples,
  FreezerWithBoxes,
  BoxGridView,
} from '@lab-data-manager/shared';

export const storageApi = {
  // Freezers
  listFreezers: () =>
    api.get<(Freezer & { box_count: number; total_samples: number; total_capacity: number })[]>(
      '/storage/freezers'
    ),

  getFreezer: (id: number) =>
    api.get<FreezerWithBoxes>(`/storage/freezers/${id}`),

  createFreezer: (input: CreateFreezerInput) =>
    api.post<Freezer>('/storage/freezers', input),

  updateFreezer: (id: number, input: UpdateFreezerInput) =>
    api.put<Freezer>(`/storage/freezers/${id}`, input),

  deleteFreezer: (id: number) =>
    api.delete(`/storage/freezers/${id}`),

  // Storage boxes
  listBoxes: (freezerId?: number) => {
    const params = freezerId ? `?freezer_id=${freezerId}` : '';
    return api.get<(StorageBox & {
      freezer_name: string;
      freezer_location: string | null;
      occupied_positions: number;
      total_positions: number;
    })[]>(`/storage/boxes${params}`);
  },

  getBox: (id: number) =>
    api.get<StorageBoxWithSamples>(`/storage/boxes/${id}`),

  getBoxGrid: (id: number) =>
    api.get<BoxGridView>(`/storage/boxes/${id}/grid`),

  createBox: (input: CreateStorageBoxInput) =>
    api.post<StorageBox>('/storage/boxes', input),

  updateBox: (id: number, input: UpdateStorageBoxInput) =>
    api.put<StorageBox>(`/storage/boxes/${id}`, input),

  deleteBox: (id: number) =>
    api.delete(`/storage/boxes/${id}`),
};
