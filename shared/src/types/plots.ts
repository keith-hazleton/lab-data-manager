// Survival plot types
export interface SurvivalDataPoint {
  day_of_study: number;
  survival_pct: number;  // 0-100
  at_risk: number;
  events: number;
}

export interface SurvivalCurveData {
  treatment_group_name: string;
  color: string;
  data: SurvivalDataPoint[];
  total_subjects: number;
  total_events: number;
}

// Timeseries plot types (weight, CSS)
export interface TimeseriesDataPoint {
  day_of_study: number;
  value: number;
}

export interface SubjectTimeseries {
  subject_id: number;
  ear_tag: string;
  experiment_name: string;
  treatment_group_name: string;
  color: string;
  data: TimeseriesDataPoint[];
}

export interface WeightTimeseriesData {
  treatment_group_name: string;
  color: string;
  // For median mode:
  data: TimeseriesDataPoint[];
  // For individual mode:
  subjects?: SubjectTimeseries[];
}

export interface CssTimeseriesData {
  treatment_group_name: string;
  color: string;
  data: TimeseriesDataPoint[];
  subjects?: SubjectTimeseries[];
}

// Unified treatment groups for cross-experiment analysis
export interface UnifiedTreatmentGroup {
  name: string;
  color: string;
  experiment_ids: number[];
  subject_count: number;
}

// Plot configuration types
export type PlotType = 'survival' | 'weight' | 'css';
export type AggregateMode = 'median' | 'individual';

export interface PlotFilters {
  experiment_ids: number[];
  treatment_group_names?: string[];
  plot_type: PlotType;
  aggregate_mode: AggregateMode;
}
