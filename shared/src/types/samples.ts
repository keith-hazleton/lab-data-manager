export interface Sample {
  id: number;
  subject_id: number;
  sample_type: SampleType;
  collection_date: string;
  day_of_study: number;
  timepoint_id?: number;
  storage_box_id?: number;
  box_position?: string;
  volume_ul?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type SampleType =
  | 'blood'
  | 'serum'
  | 'plasma'
  | 'stool'
  | 'urine'
  | 'tissue_liver'
  | 'tissue_spleen'
  | 'tissue_kidney'
  | 'tissue_heart'
  | 'tissue_lung'
  | 'tissue_brain'
  | 'tissue_colon'
  | 'tissue_small_intestine'
  | 'tissue_tumor'
  | 'tissue_other';

export interface CreateSampleInput {
  subject_id: number;
  sample_type: SampleType;
  collection_date: string;
  timepoint_id?: number;
  storage_box_id?: number;
  box_position?: string;
  volume_ul?: number;
  notes?: string;
}

export interface UpdateSampleInput {
  sample_type?: SampleType;
  collection_date?: string;
  timepoint_id?: number;
  storage_box_id?: number;
  box_position?: string;
  volume_ul?: number;
  notes?: string;
}

export interface BatchCreateSamplesInput {
  collection_date: string;
  timepoint_id?: number;
  samples: {
    subject_id: number;
    sample_type: SampleType;
    storage_box_id?: number;
    box_position?: string;
    volume_ul?: number;
    notes?: string;
  }[];
}

export interface EndpointSample extends Sample {
  exit_type?: string;
}

export interface SampleWithSubject extends Sample {
  ear_tag: string;
  cage_number: string;
  treatment_group_name: string;
  treatment_group_color?: string;
  storage_location?: string;
}

export interface GlobalSampleWithSubject extends SampleWithSubject {
  experiment_id: number;
  experiment_name: string;
}

export interface AssayResult {
  id: number;
  sample_id: number;
  assay_name: string;
  result_value?: number;
  result_unit?: string;
  result_text?: string;
  run_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAssayResultInput {
  sample_id: number;
  assay_name: string;
  result_value?: number;
  result_unit?: string;
  result_text?: string;
  run_date?: string;
  notes?: string;
}

export interface UpdateAssayResultInput {
  assay_name?: string;
  result_value?: number;
  result_unit?: string;
  result_text?: string;
  run_date?: string;
  notes?: string;
}
