import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import { ApiError } from '../middleware/error-handler.js';
import { calculateDayOfStudy } from '../services/calculations.js';
import type {
  ApiResponse,
  Sample,
  CreateSampleInput,
  UpdateSampleInput,
  BatchCreateSamplesInput,
  SampleWithSubject,
  GlobalSampleWithSubject,
  AssayResult,
  CreateAssayResultInput,
  UpdateAssayResultInput,
} from '@lab-data-manager/shared';

export const samplesRouter = Router();

// GET /api/samples?subject_id=X or experiment_id=X
samplesRouter.get('/', (req, res) => {
  const db = getDatabase();
  const { subject_id, experiment_id, sample_type, storage_box_id } = req.query;

  if (!subject_id && !experiment_id) {
    throw new ApiError(400, 'subject_id or experiment_id is required');
  }

  let query: string;
  const params: unknown[] = [];

  if (subject_id) {
    query = 'SELECT * FROM samples WHERE subject_id = ?';
    params.push(subject_id);
  } else {
    query = `
      SELECT
        sa.*,
        s.ear_tag,
        s.cage_number,
        tg.name as treatment_group_name,
        tg.color as treatment_group_color,
        CASE WHEN sb.id IS NOT NULL
          THEN f.name || ' / ' || sb.name
          ELSE NULL
        END as storage_location
      FROM samples sa
      JOIN subjects s ON s.id = sa.subject_id
      JOIN treatment_groups tg ON tg.id = s.treatment_group_id
      LEFT JOIN storage_boxes sb ON sb.id = sa.storage_box_id
      LEFT JOIN freezers f ON f.id = sb.freezer_id
      WHERE s.experiment_id = ?
    `;
    params.push(experiment_id);
  }

  if (sample_type) {
    query += subject_id ? ' AND sample_type = ?' : ' AND sa.sample_type = ?';
    params.push(sample_type);
  }

  if (storage_box_id) {
    query += subject_id ? ' AND storage_box_id = ?' : ' AND sa.storage_box_id = ?';
    params.push(storage_box_id);
  }

  query += subject_id
    ? ' ORDER BY collection_date DESC'
    : ' ORDER BY sa.collection_date DESC, s.cage_number, s.ear_tag';

  const samples = db.prepare(query).all(...params) as (Sample | SampleWithSubject)[];

  res.json({ success: true, data: samples } satisfies ApiResponse<(Sample | SampleWithSubject)[]>);
});

// GET /api/samples/global - Get all samples across experiments with filtering
// NOTE: This must be before /:id route
samplesRouter.get('/global', (req, res) => {
  const db = getDatabase();
  const { experiment_ids, sample_types, storage_status } = req.query;

  let query = `
    SELECT
      sa.*,
      s.ear_tag,
      s.cage_number,
      tg.name as treatment_group_name,
      tg.color as treatment_group_color,
      e.id as experiment_id,
      e.name as experiment_name,
      CASE WHEN sb.id IS NOT NULL
        THEN f.name || ' / ' || sb.name
        ELSE NULL
      END as storage_location
    FROM samples sa
    JOIN subjects s ON s.id = sa.subject_id
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    JOIN experiments e ON e.id = s.experiment_id
    LEFT JOIN storage_boxes sb ON sb.id = sa.storage_box_id
    LEFT JOIN freezers f ON f.id = sb.freezer_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  // Filter by experiment IDs
  if (experiment_ids && typeof experiment_ids === 'string' && experiment_ids.trim()) {
    const ids = experiment_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (ids.length > 0) {
      query += ` AND e.id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }
  }

  // Filter by sample types
  if (sample_types && typeof sample_types === 'string' && sample_types.trim()) {
    const types = sample_types.split(',').map(t => t.trim()).filter(t => t);
    if (types.length > 0) {
      query += ` AND sa.sample_type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }
  }

  // Filter by storage status
  if (storage_status === 'stored') {
    query += ' AND sa.storage_box_id IS NOT NULL';
  } else if (storage_status === 'unstored') {
    query += ' AND sa.storage_box_id IS NULL';
  }
  // 'all' or no filter = no additional WHERE clause

  query += ' ORDER BY e.name, sa.collection_date DESC, s.cage_number, s.ear_tag';

  const samples = db.prepare(query).all(...params) as GlobalSampleWithSubject[];

  res.json({ success: true, data: samples } satisfies ApiResponse<GlobalSampleWithSubject[]>);
});

// GET /api/samples/:id
samplesRouter.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const sample = db.prepare('SELECT * FROM samples WHERE id = ?').get(id) as Sample | undefined;

  if (!sample) {
    throw new ApiError(404, 'Sample not found');
  }

  res.json({ success: true, data: sample } satisfies ApiResponse<Sample>);
});

// POST /api/samples - Create single sample
samplesRouter.post('/', (req, res) => {
  const db = getDatabase();
  const input: CreateSampleInput = req.body;

  if (!input.subject_id || !input.sample_type || !input.collection_date) {
    throw new ApiError(400, 'subject_id, sample_type, and collection_date are required');
  }

  // Get experiment start date for day calculation
  const subject = db.prepare(`
    SELECT e.start_date FROM subjects s
    JOIN experiments e ON e.id = s.experiment_id
    WHERE s.id = ?
  `).get(input.subject_id) as { start_date: string } | undefined;

  if (!subject) {
    throw new ApiError(404, 'Subject not found');
  }

  const dayOfStudy = calculateDayOfStudy(input.collection_date, subject.start_date);

  const result = db.prepare(`
    INSERT INTO samples (subject_id, sample_type, collection_date, day_of_study, timepoint_id, storage_box_id, box_position, volume_ul, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.subject_id,
    input.sample_type,
    input.collection_date,
    dayOfStudy,
    input.timepoint_id || null,
    input.storage_box_id || null,
    input.box_position || null,
    input.volume_ul || null,
    input.notes || null
  );

  const sample = db.prepare('SELECT * FROM samples WHERE id = ?').get(result.lastInsertRowid) as Sample;

  res.status(201).json({ success: true, data: sample } satisfies ApiResponse<Sample>);
});

// POST /api/samples/batch - Create multiple samples
samplesRouter.post('/batch', (req, res) => {
  const db = getDatabase();
  const input: BatchCreateSamplesInput = req.body;

  if (!input.collection_date || !input.samples?.length) {
    throw new ApiError(400, 'collection_date and samples array are required');
  }

  const samples: Sample[] = [];

  const transaction = db.transaction(() => {
    for (const s of input.samples) {
      // Get experiment start date
      const subject = db.prepare(`
        SELECT e.start_date FROM subjects sub
        JOIN experiments e ON e.id = sub.experiment_id
        WHERE sub.id = ?
      `).get(s.subject_id) as { start_date: string } | undefined;

      if (!subject) continue;

      const dayOfStudy = calculateDayOfStudy(input.collection_date, subject.start_date);

      const result = db.prepare(`
        INSERT INTO samples (subject_id, sample_type, collection_date, day_of_study, timepoint_id, storage_box_id, box_position, volume_ul, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        s.subject_id,
        s.sample_type,
        input.collection_date,
        dayOfStudy,
        input.timepoint_id || null,
        s.storage_box_id || null,
        s.box_position || null,
        s.volume_ul || null,
        s.notes || null
      );

      const sample = db.prepare('SELECT * FROM samples WHERE id = ?').get(result.lastInsertRowid) as Sample;
      samples.push(sample);
    }
  });

  transaction();

  res.status(201).json({ success: true, data: samples } satisfies ApiResponse<Sample[]>);
});

// PUT /api/samples/batch-assign - Batch assign samples to a storage box
// NOTE: This must be before /:id route to avoid "batch-assign" being treated as an id
samplesRouter.put('/batch-assign', (req, res) => {
  const db = getDatabase();
  const { sample_ids, storage_box_id } = req.body as { sample_ids: number[]; storage_box_id: number | null };

  if (!sample_ids || !Array.isArray(sample_ids) || sample_ids.length === 0) {
    throw new ApiError(400, 'sample_ids array is required');
  }

  const transaction = db.transaction(() => {
    const stmt = db.prepare('UPDATE samples SET storage_box_id = ?, box_position = NULL WHERE id = ?');
    for (const id of sample_ids) {
      stmt.run(storage_box_id, id);
    }
  });

  transaction();

  res.json({ success: true, message: `${sample_ids.length} samples updated` } satisfies ApiResponse<never>);
});

// PUT /api/samples/:id
samplesRouter.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: UpdateSampleInput = req.body;

  const existing = db.prepare('SELECT * FROM samples WHERE id = ?').get(id);
  if (!existing) {
    throw new ApiError(404, 'Sample not found');
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.sample_type !== undefined) { fields.push('sample_type = ?'); values.push(input.sample_type); }
  if (input.collection_date !== undefined) { fields.push('collection_date = ?'); values.push(input.collection_date); }
  if (input.timepoint_id !== undefined) { fields.push('timepoint_id = ?'); values.push(input.timepoint_id); }
  if (input.storage_box_id !== undefined) { fields.push('storage_box_id = ?'); values.push(input.storage_box_id); }
  if (input.box_position !== undefined) { fields.push('box_position = ?'); values.push(input.box_position); }
  if (input.volume_ul !== undefined) { fields.push('volume_ul = ?'); values.push(input.volume_ul); }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }

  if (fields.length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  values.push(id);
  db.prepare(`UPDATE samples SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const sample = db.prepare('SELECT * FROM samples WHERE id = ?').get(id) as Sample;
  res.json({ success: true, data: sample } satisfies ApiResponse<Sample>);
});

// DELETE /api/samples/:id
samplesRouter.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const result = db.prepare('DELETE FROM samples WHERE id = ?').run(id);

  if (result.changes === 0) {
    throw new ApiError(404, 'Sample not found');
  }

  res.json({ success: true, message: 'Sample deleted' } satisfies ApiResponse<never>);
});

// === Assay Results ===

// GET /api/samples/:id/assays
samplesRouter.get('/:id/assays', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const assays = db.prepare(
    'SELECT * FROM assay_results WHERE sample_id = ? ORDER BY run_date DESC, created_at DESC'
  ).all(id) as AssayResult[];

  res.json({ success: true, data: assays } satisfies ApiResponse<AssayResult[]>);
});

// POST /api/samples/:id/assays
samplesRouter.post('/:id/assays', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: Omit<CreateAssayResultInput, 'sample_id'> = req.body;

  if (!input.assay_name) {
    throw new ApiError(400, 'assay_name is required');
  }

  const result = db.prepare(`
    INSERT INTO assay_results (sample_id, assay_name, result_value, result_unit, result_text, run_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.assay_name,
    input.result_value ?? null,
    input.result_unit || null,
    input.result_text || null,
    input.run_date || null,
    input.notes || null
  );

  const assay = db.prepare('SELECT * FROM assay_results WHERE id = ?').get(result.lastInsertRowid) as AssayResult;

  res.status(201).json({ success: true, data: assay } satisfies ApiResponse<AssayResult>);
});

// PUT /api/samples/:sampleId/assays/:assayId
samplesRouter.put('/:sampleId/assays/:assayId', (req, res) => {
  const db = getDatabase();
  const { assayId } = req.params;
  const input: UpdateAssayResultInput = req.body;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.assay_name !== undefined) { fields.push('assay_name = ?'); values.push(input.assay_name); }
  if (input.result_value !== undefined) { fields.push('result_value = ?'); values.push(input.result_value); }
  if (input.result_unit !== undefined) { fields.push('result_unit = ?'); values.push(input.result_unit); }
  if (input.result_text !== undefined) { fields.push('result_text = ?'); values.push(input.result_text); }
  if (input.run_date !== undefined) { fields.push('run_date = ?'); values.push(input.run_date); }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }

  if (fields.length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  values.push(assayId);
  db.prepare(`UPDATE assay_results SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const assay = db.prepare('SELECT * FROM assay_results WHERE id = ?').get(assayId) as AssayResult;
  res.json({ success: true, data: assay } satisfies ApiResponse<AssayResult>);
});

// DELETE /api/samples/:sampleId/assays/:assayId
samplesRouter.delete('/:sampleId/assays/:assayId', (req, res) => {
  const db = getDatabase();
  const { assayId } = req.params;

  const result = db.prepare('DELETE FROM assay_results WHERE id = ?').run(assayId);

  if (result.changes === 0) {
    throw new ApiError(404, 'Assay result not found');
  }

  res.json({ success: true, message: 'Assay result deleted' } satisfies ApiResponse<never>);
});
