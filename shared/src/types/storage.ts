export interface Freezer {
  id: number;
  name: string;
  location?: string;
  temperature?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFreezerInput {
  name: string;
  location?: string;
  temperature?: number;
  description?: string;
}

export interface UpdateFreezerInput {
  name?: string;
  location?: string;
  temperature?: number;
  description?: string;
}

export interface StorageBox {
  id: number;
  freezer_id: number;
  name: string;
  box_type: BoxType;
  rows: number;
  columns: number;
  shelf?: string;
  rack?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type BoxType = '81-well' | '100-well' | '25-well' | 'custom';

export interface CreateStorageBoxInput {
  freezer_id: number;
  name: string;
  box_type: BoxType;
  rows?: number;
  columns?: number;
  shelf?: string;
  rack?: string;
  notes?: string;
}

export interface UpdateStorageBoxInput {
  freezer_id?: number;
  name?: string;
  box_type?: BoxType;
  rows?: number;
  columns?: number;
  shelf?: string;
  rack?: string;
  notes?: string;
}

export interface StorageBoxWithSamples extends StorageBox {
  freezer_name: string;
  freezer_location?: string;
  samples: BoxSample[];
  occupied_positions: number;
  total_positions: number;
}

export interface BoxSample {
  id: number;
  position: string;
  sample_type: string;
  ear_tag: string;
  collection_date: string;
  experiment_name: string;
}

export interface StorageLocation {
  freezer: Freezer;
  box: StorageBox;
  position: string;
}

export interface FreezerWithBoxes extends Freezer {
  boxes: StorageBox[];
  total_samples: number;
  total_capacity: number;
}

export interface BoxPosition {
  position: string;
  row: number;
  column: number;
  occupied: boolean;
  sample?: BoxSample;
}

export interface BoxGridView {
  box: StorageBox;
  positions: BoxPosition[][];
}
