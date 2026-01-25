// Clinical Scoring System (CSS) definitions

export const WEIGHT_SCORE_THRESHOLDS = {
  0: { min: 0, label: 'Normal', description: '100% or above baseline' },
  1: { min: -4, label: 'Mild', description: '96-99% of baseline' },
  2: { min: -9, label: 'Moderate', description: '91-95% of baseline' },
  3: { min: -14, label: 'Severe', description: '86-90% of baseline' },
  4: { min: -Infinity, label: 'Critical', description: '85% or below baseline' },
} as const;

export const STOOL_SCORES = {
  0: { label: 'Normal', description: 'Formed, normal color' },
  1: { label: 'Soft', description: 'Soft but formed' },
  2: { label: 'Loose', description: 'Loose, paste-like' },
  3: { label: 'Watery', description: 'Watery, no form' },
  4: { label: 'Bloody', description: 'Visible blood present' },
} as const;

export const BEHAVIOR_SCORES = {
  0: { label: 'Normal', description: 'Active, alert, grooming' },
  1: { label: 'Mild', description: 'Slightly reduced activity' },
  2: { label: 'Moderate', description: 'Hunched, reduced grooming' },
  3: { label: 'Severe', description: 'Lethargic, piloerection' },
  4: { label: 'Critical', description: 'Moribund, unresponsive' },
} as const;

export const CSS_SEVERITY_LEVELS = {
  normal: { max: 2, color: 'green', label: 'Normal' },
  mild: { max: 4, color: 'yellow', label: 'Mild' },
  moderate: { max: 6, color: 'orange', label: 'Moderate' },
  severe: { max: 9, color: 'red', label: 'Severe' },
  critical: { max: 12, color: 'darkred', label: 'Critical' },
} as const;

export function getWeightScore(percentChange: number): number {
  if (percentChange >= 0) return 0;
  if (percentChange >= -4) return 1;
  if (percentChange >= -9) return 2;
  if (percentChange >= -14) return 3;
  return 4;
}

export function getCssSeverity(totalCss: number): keyof typeof CSS_SEVERITY_LEVELS {
  if (totalCss <= 2) return 'normal';
  if (totalCss <= 4) return 'mild';
  if (totalCss <= 6) return 'moderate';
  if (totalCss <= 9) return 'severe';
  return 'critical';
}

export function calculateTotalCss(
  weightScore: number,
  stoolScore: number,
  behaviorScore: number
): number {
  return weightScore + stoolScore + behaviorScore;
}

export const DEFAULT_ENDPOINT_WEIGHT_LOSS_PCT = 15;
export const DEFAULT_ENDPOINT_CSS_THRESHOLD = 8;
export const DEFAULT_ENDPOINT_CSS_OPERATOR = '>=';
