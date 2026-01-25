export interface Subject {
  id: number;
  experiment_id: number;
  treatment_group_id: number;
  ear_tag: string;
  cage_number: string;
  sex: Sex;
  diet?: string;
  date_of_birth?: string;
  baseline_weight?: number;
  status: SubjectStatus;
  exit_date?: string;
  exit_type?: ExitType;
  exit_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type Sex = 'M' | 'F';
export type SubjectStatus = 'alive' | 'dead' | 'sacrificed' | 'excluded';
export type ExitType = 'natural_death' | 'sacrificed_endpoint' | 'sacrificed_scheduled' | 'excluded' | 'other';

export interface CreateSubjectInput {
  experiment_id: number;
  treatment_group_id: number;
  ear_tag: string;
  cage_number: string;
  sex: Sex;
  diet?: string;
  date_of_birth?: string;
  baseline_weight?: number;
  notes?: string;
}

export interface UpdateSubjectInput {
  treatment_group_id?: number;
  ear_tag?: string;
  cage_number?: string;
  sex?: Sex;
  diet?: string;
  date_of_birth?: string;
  baseline_weight?: number;
  status?: SubjectStatus;
  exit_date?: string;
  exit_type?: ExitType;
  exit_reason?: string;
  notes?: string;
}

export interface BatchCreateSubjectsInput {
  experiment_id: number;
  treatment_group_id: number;
  cage_number: string;
  sex: Sex;
  count: number;
  diet?: string;
  ear_tag_prefix?: string;
  ear_tag_start?: number;
  date_of_birth?: string;
  baseline_weight?: number;
}

export interface SubjectWithLatestObservation extends Subject {
  treatment_group_name: string;
  treatment_group_color?: string;
  latest_observation?: {
    observation_date: string;
    weight?: number;
    weight_pct_change?: number;
    weight_score?: number;
    stool_score?: number;
    behavior_score?: number;
    total_css?: number;
    notes?: string;
  };
}

export interface CageGroup {
  cage_number: string;
  experiment_id: number;
  treatment_group_id: number;
  treatment_group_name: string;
  treatment_group_color?: string;
  diet?: string;
  subjects: SubjectWithLatestObservation[];
  total_count: number;
  alive_count: number;
  observed_today: number;
}

export interface RecordExitInput {
  exit_date: string;
  exit_type: ExitType;
  exit_reason?: string;
  final_observation?: {
    weight?: number;
    stool_score?: number;
    behavior_score?: number;
    notes?: string;
  };
}
