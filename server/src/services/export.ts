import type { ExportFormat } from '@lab-data-manager/shared';

export interface SurvivalRow {
  ear_tag: string;
  treatment_group: string;
  start_date: string;
  end_date: string | null;
  event: 0 | 1;
  days_survived: number;
}

export interface ObservationExportRow {
  experiment_name: string;
  ear_tag: string;
  cage_number: string;
  treatment_group: string;
  observation_date: string;
  day_of_study: number;
  weight: number | null;
  weight_pct_change: number | null;
  weight_score: number | null;
  stool_score: number | null;
  behavior_score: number | null;
  total_css: number | null;
  notes: string | null;
}

export interface SampleInventoryRow {
  sample_id: number;
  experiment_name: string;
  ear_tag: string;
  cage_number: string;
  treatment_group: string;
  sample_type: string;
  collection_date: string;
  day_of_study: number;
  freezer_name: string | null;
  box_name: string | null;
  box_position: string | null;
  volume_ul: number | null;
}

export function convertToCSV<T extends object>(
  data: T[],
  includeHeaders = true
): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const lines: string[] = [];

  if (includeHeaders) {
    lines.push(headers.join(','));
  }

  for (const row of data) {
    const rowRecord = row as Record<string, unknown>;
    const values = headers.map((header) => {
      const value = rowRecord[header];
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

export function formatExport<T extends object>(
  data: T[],
  format: ExportFormat,
  includeHeaders = true
): { content: string; contentType: string; extension: string } {
  if (format === 'csv') {
    return {
      content: convertToCSV(data, includeHeaders),
      contentType: 'text/csv',
      extension: 'csv',
    };
  }

  return {
    content: JSON.stringify(data, null, 2),
    contentType: 'application/json',
    extension: 'json',
  };
}

export function calculateSurvivalDays(startDate: string, endDate: string | null): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
