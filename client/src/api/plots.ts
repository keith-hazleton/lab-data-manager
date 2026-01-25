import { api } from './client';
import type {
  SurvivalCurveData,
  WeightTimeseriesData,
  CssTimeseriesData,
  UnifiedTreatmentGroup,
  AggregateMode,
} from '@lab-data-manager/shared';

export const plotsApi = {
  getTreatmentGroups: (experimentIds: number[]) => {
    const params = new URLSearchParams();
    if (experimentIds.length > 0) {
      params.append('experiment_ids', experimentIds.join(','));
    }
    const queryString = params.toString();
    return api.get<UnifiedTreatmentGroup[]>(`/plots/treatment-groups${queryString ? `?${queryString}` : ''}`);
  },

  getSurvivalData: (experimentIds: number[]) => {
    const params = new URLSearchParams();
    if (experimentIds.length > 0) {
      params.append('experiment_ids', experimentIds.join(','));
    }
    const queryString = params.toString();
    return api.get<SurvivalCurveData[]>(`/plots/survival${queryString ? `?${queryString}` : ''}`);
  },

  getWeightData: (experimentIds: number[], aggregate: AggregateMode = 'median') => {
    const params = new URLSearchParams();
    if (experimentIds.length > 0) {
      params.append('experiment_ids', experimentIds.join(','));
    }
    params.append('aggregate', aggregate);
    return api.get<WeightTimeseriesData[]>(`/plots/weight?${params}`);
  },

  getCssData: (experimentIds: number[], aggregate: AggregateMode = 'median') => {
    const params = new URLSearchParams();
    if (experimentIds.length > 0) {
      params.append('experiment_ids', experimentIds.join(','));
    }
    params.append('aggregate', aggregate);
    return api.get<CssTimeseriesData[]>(`/plots/css?${params}`);
  },
};
