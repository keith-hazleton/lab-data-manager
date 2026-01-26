import type { ExportFormat } from '@lab-data-manager/shared';
import { getDatabase } from '../db/connection.js';

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

// ============================================
// Comprehensive Table Export Functions
// ============================================

export interface ExperimentExportRow {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  baseline_day_offset: number;
  status: string;
  created_at: string;
}

export interface TreatmentGroupExportRow {
  id: number;
  experiment_id: number;
  experiment_name: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
}

export interface SubjectExportRow {
  id: number;
  experiment_id: number;
  experiment_name: string;
  treatment_group_id: number;
  treatment_group_name: string;
  ear_tag: string;
  sex: string;
  cage_number: string | null;
  diet: string | null;
  status: string;
  exit_type: string | null;
  exit_date: string | null;
  exit_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface AllObservationsExportRow extends ObservationExportRow {
  subject_id: number;
}

export interface AllSamplesExportRow extends SampleInventoryRow {
  subject_id: number;
  storage_box_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface StorageBoxExportRow {
  id: number;
  freezer_id: number;
  freezer_name: string;
  name: string;
  shelf: string | null;
  rack: string | null;
  rows: number;
  columns: number;
  created_at: string;
}

export interface FreezerExportRow {
  id: number;
  name: string;
  location: string | null;
  temperature: number | null;
  created_at: string;
}

/**
 * Export all experiments with their details
 */
export function exportExperiments(): ExperimentExportRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      id,
      name,
      description,
      start_date,
      end_date,
      baseline_day_offset,
      status,
      created_at
    FROM experiments
    ORDER BY id
  `).all() as ExperimentExportRow[];
}

/**
 * Export all treatment groups with experiment names
 */
export function exportTreatmentGroups(): TreatmentGroupExportRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      tg.id,
      tg.experiment_id,
      e.name as experiment_name,
      tg.name,
      tg.description,
      tg.color,
      tg.sort_order
    FROM treatment_groups tg
    JOIN experiments e ON e.id = tg.experiment_id
    ORDER BY tg.experiment_id, tg.sort_order
  `).all() as TreatmentGroupExportRow[];
}

/**
 * Export all subjects with experiment and treatment group names
 */
export function exportSubjects(): SubjectExportRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      s.id,
      s.experiment_id,
      e.name as experiment_name,
      s.treatment_group_id,
      tg.name as treatment_group_name,
      s.ear_tag,
      s.sex,
      s.cage_number,
      s.diet,
      s.status,
      s.exit_type,
      s.exit_date,
      s.exit_reason,
      s.notes,
      s.created_at
    FROM subjects s
    JOIN experiments e ON e.id = s.experiment_id
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    ORDER BY s.experiment_id, tg.sort_order, s.ear_tag
  `).all() as SubjectExportRow[];
}

/**
 * Export all observations across all experiments
 */
export function exportAllObservations(): AllObservationsExportRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      o.id,
      o.subject_id,
      e.name as experiment_name,
      s.ear_tag,
      s.cage_number,
      tg.name as treatment_group,
      o.observation_date,
      o.day_of_study,
      o.weight,
      o.weight_pct_change,
      o.weight_score,
      o.stool_score,
      o.behavior_score,
      o.total_css,
      o.notes
    FROM observations o
    JOIN subjects s ON s.id = o.subject_id
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    JOIN experiments e ON e.id = s.experiment_id
    ORDER BY e.id, o.observation_date, tg.sort_order, s.ear_tag
  `).all() as AllObservationsExportRow[];
}

/**
 * Export all samples across all experiments with storage locations
 */
export function exportAllSamples(): AllSamplesExportRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      sa.id as sample_id,
      sa.subject_id,
      e.name as experiment_name,
      s.ear_tag,
      s.cage_number,
      tg.name as treatment_group,
      sa.sample_type,
      sa.collection_date,
      sa.day_of_study,
      f.name as freezer_name,
      sb.name as box_name,
      sa.storage_box_id,
      sa.box_position,
      sa.volume_ul,
      sa.notes,
      sa.created_at
    FROM samples sa
    JOIN subjects s ON s.id = sa.subject_id
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    JOIN experiments e ON e.id = s.experiment_id
    LEFT JOIN storage_boxes sb ON sb.id = sa.storage_box_id
    LEFT JOIN freezers f ON f.id = sb.freezer_id
    ORDER BY e.id, sa.collection_date, sa.sample_type, tg.sort_order, s.ear_tag
  `).all() as AllSamplesExportRow[];
}

/**
 * Export all storage boxes with freezer names
 */
export function exportStorageBoxes(): StorageBoxExportRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      sb.id,
      sb.freezer_id,
      f.name as freezer_name,
      sb.name,
      sb.shelf,
      sb.rack,
      sb.rows,
      sb.columns,
      sb.created_at
    FROM storage_boxes sb
    JOIN freezers f ON f.id = sb.freezer_id
    ORDER BY f.name, sb.shelf, sb.rack, sb.name
  `).all() as StorageBoxExportRow[];
}

/**
 * Export all freezers
 */
export function exportFreezers(): FreezerExportRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      id,
      name,
      location,
      temperature,
      created_at
    FROM freezers
    ORDER BY name
  `).all() as FreezerExportRow[];
}

/**
 * Generate export metadata
 */
export function generateExportMetadata(): {
  exportTimestamp: string;
  version: string;
  tables: { name: string; rowCount: number }[];
} {
  const db = getDatabase();

  const tables = [
    { name: 'experiments', rowCount: (db.prepare('SELECT COUNT(*) as count FROM experiments').get() as { count: number }).count },
    { name: 'treatment_groups', rowCount: (db.prepare('SELECT COUNT(*) as count FROM treatment_groups').get() as { count: number }).count },
    { name: 'subjects', rowCount: (db.prepare('SELECT COUNT(*) as count FROM subjects').get() as { count: number }).count },
    { name: 'observations', rowCount: (db.prepare('SELECT COUNT(*) as count FROM observations').get() as { count: number }).count },
    { name: 'samples', rowCount: (db.prepare('SELECT COUNT(*) as count FROM samples').get() as { count: number }).count },
    { name: 'storage_boxes', rowCount: (db.prepare('SELECT COUNT(*) as count FROM storage_boxes').get() as { count: number }).count },
    { name: 'freezers', rowCount: (db.prepare('SELECT COUNT(*) as count FROM freezers').get() as { count: number }).count },
  ];

  return {
    exportTimestamp: new Date().toISOString(),
    version: '1.0.0',
    tables,
  };
}
