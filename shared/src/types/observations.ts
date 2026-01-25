export interface Observation {
  id: number;
  subject_id: number;
  observation_date: string;
  day_of_study: number;
  weight?: number;
  weight_pct_change?: number;
  weight_score?: number;
  stool_score?: number;
  behavior_score?: number;
  total_css?: number;
  notes?: string;
  observer?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateObservationInput {
  subject_id: number;
  observation_date: string;
  weight?: number;
  stool_score?: number;
  behavior_score?: number;
  notes?: string;
  observer?: string;
}

export interface UpdateObservationInput {
  observation_date?: string;
  weight?: number;
  stool_score?: number;
  behavior_score?: number;
  notes?: string;
  observer?: string;
}

export interface BatchCreateObservationsInput {
  observation_date: string;
  observer?: string;
  observations: {
    subject_id: number;
    weight?: number;
    stool_score?: number;
    behavior_score?: number;
    notes?: string;
  }[];
}

export interface ObservationWithSubject extends Observation {
  ear_tag: string;
  cage_number: string;
  treatment_group_name: string;
}

export interface ObservationResponse extends Observation {
  alerts: EndpointAlert[];
}

export interface EndpointAlert {
  type: 'weight_loss' | 'css_threshold';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}

export interface DailyObservationSummary {
  date: string;
  day_of_study: number;
  total_subjects: number;
  observed_count: number;
  pending_count: number;
  alerts_count: number;
  timepoint_name?: string;
  samples_collected: number;
}
