import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import { ApiError } from '../middleware/error-handler.js';
import {
  formatExport,
  calculateSurvivalDays,
  type SurvivalRow,
  type ObservationExportRow,
  type SampleInventoryRow
} from '../services/export.js';
import type { ExportFormat } from '@lab-data-manager/shared';

export const exportRouter = Router();

// GET /api/export/survival?experiment_id=X&format=csv
exportRouter.get('/survival', (req, res) => {
  const db = getDatabase();
  const { experiment_id, format = 'csv' } = req.query;

  if (!experiment_id) {
    throw new ApiError(400, 'experiment_id is required');
  }

  const rows = db.prepare(`
    SELECT
      s.ear_tag,
      tg.name as treatment_group,
      e.start_date,
      s.exit_date as end_date,
      CASE WHEN s.status IN ('dead', 'sacrificed') THEN 1 ELSE 0 END as event
    FROM subjects s
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    JOIN experiments e ON e.id = s.experiment_id
    WHERE s.experiment_id = ?
    ORDER BY tg.sort_order, s.ear_tag
  `).all(experiment_id) as {
    ear_tag: string;
    treatment_group: string;
    start_date: string;
    end_date: string | null;
    event: number;
  }[];

  const data: SurvivalRow[] = rows.map(row => ({
    ear_tag: row.ear_tag,
    treatment_group: row.treatment_group,
    start_date: row.start_date,
    end_date: row.end_date,
    event: row.event as 0 | 1,
    days_survived: calculateSurvivalDays(row.start_date, row.end_date),
  }));

  const { content, contentType, extension } = formatExport(data, format as ExportFormat);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="survival_${experiment_id}.${extension}"`);
  res.send(content);
});

// GET /api/export/observations?experiment_id=X&format=csv
exportRouter.get('/observations', (req, res) => {
  const db = getDatabase();
  const { experiment_id, start_date, end_date, format = 'csv' } = req.query;

  if (!experiment_id) {
    throw new ApiError(400, 'experiment_id is required');
  }

  let query = `
    SELECT
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
    WHERE s.experiment_id = ?
  `;
  const params: unknown[] = [experiment_id];

  if (start_date && end_date) {
    query += ' AND o.observation_date BETWEEN ? AND ?';
    params.push(start_date, end_date);
  }

  query += ' ORDER BY o.observation_date, tg.sort_order, s.cage_number, s.ear_tag';

  const data = db.prepare(query).all(...params) as ObservationExportRow[];

  const { content, contentType, extension } = formatExport(data, format as ExportFormat);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="observations_${experiment_id}.${extension}"`);
  res.send(content);
});

// GET /api/export/samples?experiment_id=X&format=csv
exportRouter.get('/samples', (req, res) => {
  const db = getDatabase();
  const { experiment_id, sample_type, format = 'csv' } = req.query;

  if (!experiment_id) {
    throw new ApiError(400, 'experiment_id is required');
  }

  let query = `
    SELECT
      sa.id as sample_id,
      e.name as experiment_name,
      s.ear_tag,
      s.cage_number,
      tg.name as treatment_group,
      sa.sample_type,
      sa.collection_date,
      sa.day_of_study,
      f.name as freezer_name,
      sb.name as box_name,
      sa.box_position,
      sa.volume_ul
    FROM samples sa
    JOIN subjects s ON s.id = sa.subject_id
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    JOIN experiments e ON e.id = s.experiment_id
    LEFT JOIN storage_boxes sb ON sb.id = sa.storage_box_id
    LEFT JOIN freezers f ON f.id = sb.freezer_id
    WHERE s.experiment_id = ?
  `;
  const params: unknown[] = [experiment_id];

  if (sample_type) {
    query += ' AND sa.sample_type = ?';
    params.push(sample_type);
  }

  query += ' ORDER BY sa.collection_date, sa.sample_type, tg.sort_order, s.ear_tag';

  const data = db.prepare(query).all(...params) as SampleInventoryRow[];

  const { content, contentType, extension } = formatExport(data, format as ExportFormat);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="samples_${experiment_id}.${extension}"`);
  res.send(content);
});

// GET /api/export/storage?freezer_id=X&format=csv
exportRouter.get('/storage', (req, res) => {
  const db = getDatabase();
  const { freezer_id, box_id, format = 'csv' } = req.query;

  if (!freezer_id && !box_id) {
    throw new ApiError(400, 'freezer_id or box_id is required');
  }

  let query = `
    SELECT
      f.name as freezer_name,
      f.location as freezer_location,
      sb.name as box_name,
      sb.shelf,
      sb.rack,
      sa.box_position,
      sa.sample_type,
      s.ear_tag,
      e.name as experiment_name,
      tg.name as treatment_group,
      sa.collection_date,
      sa.volume_ul
    FROM samples sa
    JOIN subjects s ON s.id = sa.subject_id
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    JOIN experiments e ON e.id = s.experiment_id
    JOIN storage_boxes sb ON sb.id = sa.storage_box_id
    JOIN freezers f ON f.id = sb.freezer_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (freezer_id) {
    query += ' AND f.id = ?';
    params.push(freezer_id);
  }

  if (box_id) {
    query += ' AND sb.id = ?';
    params.push(box_id);
  }

  query += ' ORDER BY f.name, sb.shelf, sb.rack, sb.name, sa.box_position';

  const data = db.prepare(query).all(...params);

  const { content, contentType, extension } = formatExport(data as Record<string, unknown>[], format as ExportFormat);

  const filename = box_id ? `storage_box_${box_id}` : `storage_freezer_${freezer_id}`;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
  res.send(content);
});
