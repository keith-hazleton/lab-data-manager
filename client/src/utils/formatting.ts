export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function getDayOfStudy(startDate: string, date?: string): number {
  const start = new Date(startDate);
  const target = date ? new Date(date) : new Date();
  // Reset to midnight for accurate day calculation
  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function formatWeight(weight: number | undefined | null): string {
  if (weight === undefined || weight === null) return '-';
  return `${weight.toFixed(1)}g`;
}

export function formatPercentChange(pct: number | undefined | null): string {
  if (pct === undefined || pct === null) return '-';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function getCssSeverityColor(css: number | undefined | null): string {
  if (css === undefined || css === null) return 'gray';
  if (css <= 2) return 'green';
  if (css <= 4) return 'yellow';
  if (css <= 6) return 'orange';
  if (css <= 9) return 'red';
  return 'darkred';
}

export function getCssSeverityClass(css: number | undefined | null): string {
  if (css === undefined || css === null) return 'text-gray-400';
  if (css <= 2) return 'text-green-600';
  if (css <= 4) return 'text-yellow-600';
  if (css <= 6) return 'text-orange-500';
  if (css <= 9) return 'text-red-600';
  return 'text-red-900';
}

export function getWeightChangeClass(pct: number | undefined | null): string {
  if (pct === undefined || pct === null) return 'text-gray-400';
  if (pct >= 0) return 'text-green-600';
  if (pct >= -5) return 'text-yellow-600';
  if (pct >= -10) return 'text-orange-500';
  if (pct >= -15) return 'text-red-600';
  return 'text-red-900';
}

export function calculateWeightBarWidth(pct: number | undefined | null): number {
  if (pct === undefined || pct === null) return 0;
  if (pct >= 0) return 0;  // No weight loss = empty bar
  // Map 0% loss to 0% width, -15% loss to 100% width
  // Shows how close to endpoint (-15%) the mouse is
  const clamped = Math.max(-15, Math.min(0, pct));
  return (Math.abs(clamped) / 15) * 100;
}
