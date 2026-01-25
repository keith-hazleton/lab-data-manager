import { getWeightScore, calculateTotalCss } from '@lab-data-manager/shared';

export interface CalculatedObservation {
  weight_pct_change: number | null;
  weight_score: number | null;
  total_css: number | null;
  day_of_study: number;
}

export function calculateWeightPercentChange(
  currentWeight: number | undefined,
  baselineWeight: number | undefined
): number | null {
  if (currentWeight === undefined || baselineWeight === undefined || baselineWeight === 0) {
    return null;
  }
  return ((currentWeight - baselineWeight) / baselineWeight) * 100;
}

export function calculateObservation(
  weight: number | undefined,
  baselineWeight: number | undefined,
  stoolScore: number | undefined,
  behaviorScore: number | undefined,
  observationDate: string,
  experimentStartDate: string,
  baselineDayOffset: number = 0
): CalculatedObservation {
  const dayOfStudy = calculateDayOfStudy(observationDate, experimentStartDate);
  const isBaselineOrAfter = dayOfStudy >= baselineDayOffset;

  // Only calculate weight % change if we have a baseline weight and are at/after baseline day
  const weightPctChange = isBaselineOrAfter
    ? calculateWeightPercentChange(weight, baselineWeight)
    : null;
  const weightScore = weightPctChange !== null ? getWeightScore(weightPctChange) : null;

  // Only calculate CSS if we're at/after baseline day
  let totalCss: number | null = null;
  if (isBaselineOrAfter && weightScore !== null && stoolScore !== undefined && behaviorScore !== undefined) {
    totalCss = calculateTotalCss(weightScore, stoolScore, behaviorScore);
  }

  return {
    weight_pct_change: weightPctChange !== null ? Math.round(weightPctChange * 100) / 100 : null,
    weight_score: weightScore,
    total_css: totalCss,
    day_of_study: dayOfStudy,
  };
}

export function calculateDayOfStudy(observationDate: string, experimentStartDate: string): number {
  const obsDate = new Date(observationDate);
  const startDate = new Date(experimentStartDate);
  const diffTime = obsDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function formatDateForSql(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getTodayDate(): string {
  return formatDateForSql(new Date());
}
