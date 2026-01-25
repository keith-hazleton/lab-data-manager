export interface Experiment {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  status: ExperimentStatus;
  baseline_day_offset: number;
  endpoint_weight_loss_pct: number;
  endpoint_css_threshold?: number;
  endpoint_css_operator?: CssOperator;
  created_at: string;
  updated_at: string;
}

export type ExperimentStatus = 'active' | 'completed' | 'archived';
export type CssOperator = '>=' | '>' | '=' | '<' | '<=';

export interface CreateExperimentInput {
  name: string;
  description?: string;
  start_date: string;
  baseline_day_offset?: number;
  endpoint_weight_loss_pct?: number;
  endpoint_css_threshold?: number;
  endpoint_css_operator?: CssOperator;
}

export interface UpdateExperimentInput {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: ExperimentStatus;
  baseline_day_offset?: number;
  endpoint_weight_loss_pct?: number;
  endpoint_css_threshold?: number;
  endpoint_css_operator?: CssOperator;
}

export interface TreatmentGroup {
  id: number;
  experiment_id: number;
  name: string;
  description?: string;
  color?: string;
  sort_order: number;
  created_at: string;
}

export interface CreateTreatmentGroupInput {
  experiment_id: number;
  name: string;
  description?: string;
  color?: string;
  sort_order?: number;
}

export interface UpdateTreatmentGroupInput {
  name?: string;
  description?: string;
  color?: string;
  sort_order?: number;
}

export interface ProtocolTimepoint {
  id: number;
  experiment_id: number;
  day_offset: number;
  name: string;
  description?: string;
  sample_types: string[];
  created_at: string;
}

export interface CreateProtocolTimepointInput {
  experiment_id: number;
  day_offset: number;
  name: string;
  description?: string;
  sample_types?: string[];
}

export interface UpdateProtocolTimepointInput {
  day_offset?: number;
  name?: string;
  description?: string;
  sample_types?: string[];
}

export interface ExperimentWithGroups extends Experiment {
  treatment_groups: TreatmentGroup[];
  protocol_timepoints: ProtocolTimepoint[];
}

export interface ExperimentSummary extends Experiment {
  total_mice: number;
  alive_mice: number;
  completed_today: number;
  pending_today: number;
}
