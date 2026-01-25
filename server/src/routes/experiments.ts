import { Router } from 'express';
import Database from 'better-sqlite3';
import { getDatabase } from '../db/connection.js';
import { ApiError } from '../middleware/error-handler.js';
import { getTodayDate, calculateObservation } from '../services/calculations.js';
import type {
  ApiResponse,
  Experiment,
  ExperimentWithGroups,
  ExperimentSummary,
  CreateExperimentInput,
  UpdateExperimentInput,
  TreatmentGroup,
  CreateTreatmentGroupInput,
  UpdateTreatmentGroupInput,
  ProtocolTimepoint,
  CreateProtocolTimepointInput,
  UpdateProtocolTimepointInput,
} from '@lab-data-manager/shared';

export const experimentsRouter = Router();

// Helper function to recalculate all observations when baseline day changes
function recalculateExperimentObservations(
  db: Database.Database,
  experimentId: number,
  baselineDayOffset: number,
  startDate: string
): void {
  // Get all subjects in this experiment
  const subjects = db.prepare(`
    SELECT id FROM subjects WHERE experiment_id = ?
  `).all(experimentId) as { id: number }[];

  for (const subject of subjects) {
    // Find the observation on the baseline day to get the new baseline weight
    const baselineObs = db.prepare(`
      SELECT weight FROM observations
      WHERE subject_id = ? AND day_of_study = ?
    `).get(subject.id, baselineDayOffset) as { weight: number | null } | undefined;

    const baselineWeight = baselineObs?.weight ?? null;

    // Update subject's baseline_weight
    db.prepare('UPDATE subjects SET baseline_weight = ? WHERE id = ?')
      .run(baselineWeight, subject.id);

    // Get all observations for this subject and recalculate
    const observations = db.prepare(`
      SELECT id, observation_date, day_of_study, weight, stool_score, behavior_score
      FROM observations WHERE subject_id = ?
    `).all(subject.id) as {
      id: number;
      observation_date: string;
      day_of_study: number;
      weight: number | null;
      stool_score: number | null;
      behavior_score: number | null;
    }[];

    for (const obs of observations) {
      const calculated = calculateObservation(
        obs.weight ?? undefined,
        baselineWeight ?? undefined,
        obs.stool_score ?? undefined,
        obs.behavior_score ?? undefined,
        obs.observation_date,
        startDate,
        baselineDayOffset
      );

      db.prepare(`
        UPDATE observations SET
          weight_pct_change = ?,
          weight_score = ?,
          total_css = ?
        WHERE id = ?
      `).run(
        calculated.weight_pct_change,
        calculated.weight_score,
        calculated.total_css,
        obs.id
      );
    }
  }

  console.log(`Recalculated observations for ${subjects.length} subjects in experiment ${experimentId}`);
}

// GET /api/experiments - List all experiments
experimentsRouter.get('/', (_req, res) => {
  const db = getDatabase();
  const today = getTodayDate();

  const experiments = db.prepare(`
    SELECT
      e.*,
      COUNT(DISTINCT s.id) as total_mice,
      COUNT(DISTINCT CASE WHEN s.status = 'alive' THEN s.id END) as alive_mice,
      COUNT(DISTINCT CASE WHEN o.observation_date = ? AND s.status = 'alive' THEN s.id END) as completed_today,
      (SELECT COUNT(*) FROM subjects WHERE experiment_id = e.id AND status = 'alive') -
        COUNT(DISTINCT CASE WHEN o.observation_date = ? AND s.status = 'alive' THEN s.id END) as pending_today
    FROM experiments e
    LEFT JOIN subjects s ON s.experiment_id = e.id
    LEFT JOIN observations o ON o.subject_id = s.id AND o.observation_date = ?
    GROUP BY e.id
    ORDER BY e.status = 'active' DESC, e.updated_at DESC
  `).all(today, today, today) as ExperimentSummary[];

  res.json({ success: true, data: experiments } satisfies ApiResponse<ExperimentSummary[]>);
});

// GET /api/experiments/:id - Get experiment with groups and timepoints
experimentsRouter.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const experiment = db.prepare('SELECT * FROM experiments WHERE id = ?').get(id) as Experiment | undefined;

  if (!experiment) {
    throw new ApiError(404, 'Experiment not found');
  }

  const treatment_groups = db.prepare(
    'SELECT * FROM treatment_groups WHERE experiment_id = ? ORDER BY sort_order'
  ).all(id) as TreatmentGroup[];

  const protocol_timepoints = db.prepare(`
    SELECT id, experiment_id, day_offset, name, description, sample_types, created_at
    FROM protocol_timepoints
    WHERE experiment_id = ?
    ORDER BY day_offset
  `).all(id) as (Omit<ProtocolTimepoint, 'sample_types'> & { sample_types: string })[];

  // Parse sample_types JSON
  const parsedTimepoints: ProtocolTimepoint[] = protocol_timepoints.map(tp => ({
    ...tp,
    sample_types: tp.sample_types ? JSON.parse(tp.sample_types) : [],
  }));

  const result: ExperimentWithGroups = {
    ...experiment,
    treatment_groups,
    protocol_timepoints: parsedTimepoints,
  };

  res.json({ success: true, data: result } satisfies ApiResponse<ExperimentWithGroups>);
});

// POST /api/experiments - Create experiment
experimentsRouter.post('/', (req, res) => {
  const db = getDatabase();
  const input: CreateExperimentInput = req.body;

  if (!input.name || !input.start_date) {
    throw new ApiError(400, 'Name and start_date are required');
  }

  const result = db.prepare(`
    INSERT INTO experiments (name, description, start_date, baseline_day_offset, endpoint_weight_loss_pct, endpoint_css_threshold, endpoint_css_operator)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.name,
    input.description || null,
    input.start_date,
    input.baseline_day_offset ?? 0,
    input.endpoint_weight_loss_pct ?? 15,
    input.endpoint_css_threshold ?? null,
    input.endpoint_css_operator ?? null
  );

  const experiment = db.prepare('SELECT * FROM experiments WHERE id = ?').get(result.lastInsertRowid) as Experiment;

  res.status(201).json({ success: true, data: experiment } satisfies ApiResponse<Experiment>);
});

// PUT /api/experiments/:id - Update experiment
experimentsRouter.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: UpdateExperimentInput = req.body;

  const existing = db.prepare('SELECT * FROM experiments WHERE id = ?').get(id) as Experiment | undefined;
  if (!existing) {
    throw new ApiError(404, 'Experiment not found');
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
  if (input.start_date !== undefined) { fields.push('start_date = ?'); values.push(input.start_date); }
  if (input.end_date !== undefined) { fields.push('end_date = ?'); values.push(input.end_date); }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }
  if (input.baseline_day_offset !== undefined) { fields.push('baseline_day_offset = ?'); values.push(input.baseline_day_offset); }
  if (input.endpoint_weight_loss_pct !== undefined) { fields.push('endpoint_weight_loss_pct = ?'); values.push(input.endpoint_weight_loss_pct); }
  if (input.endpoint_css_threshold !== undefined) { fields.push('endpoint_css_threshold = ?'); values.push(input.endpoint_css_threshold); }
  if (input.endpoint_css_operator !== undefined) { fields.push('endpoint_css_operator = ?'); values.push(input.endpoint_css_operator); }

  if (fields.length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  values.push(id);
  db.prepare(`UPDATE experiments SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // If baseline_day_offset changed, recalculate all observations
  const newBaselineDayOffset = input.baseline_day_offset ?? existing.baseline_day_offset;
  if (input.baseline_day_offset !== undefined && input.baseline_day_offset !== existing.baseline_day_offset) {
    recalculateExperimentObservations(db, parseInt(id), newBaselineDayOffset, existing.start_date);
  }

  const experiment = db.prepare('SELECT * FROM experiments WHERE id = ?').get(id) as Experiment;
  res.json({ success: true, data: experiment } satisfies ApiResponse<Experiment>);
});

// DELETE /api/experiments/:id
experimentsRouter.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const result = db.prepare('DELETE FROM experiments WHERE id = ?').run(id);

  if (result.changes === 0) {
    throw new ApiError(404, 'Experiment not found');
  }

  res.json({ success: true, message: 'Experiment deleted' } satisfies ApiResponse<never>);
});

// === Treatment Groups ===

// GET /api/experiments/:id/groups
experimentsRouter.get('/:id/groups', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const groups = db.prepare(
    'SELECT * FROM treatment_groups WHERE experiment_id = ? ORDER BY sort_order'
  ).all(id) as TreatmentGroup[];

  res.json({ success: true, data: groups } satisfies ApiResponse<TreatmentGroup[]>);
});

// POST /api/experiments/:id/groups
experimentsRouter.post('/:id/groups', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: Omit<CreateTreatmentGroupInput, 'experiment_id'> = req.body;

  if (!input.name) {
    throw new ApiError(400, 'Name is required');
  }

  // Get max sort_order
  const maxOrder = db.prepare(
    'SELECT MAX(sort_order) as max FROM treatment_groups WHERE experiment_id = ?'
  ).get(id) as { max: number | null };

  const result = db.prepare(`
    INSERT INTO treatment_groups (experiment_id, name, description, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.description || null,
    input.color || null,
    input.sort_order ?? (maxOrder.max ?? -1) + 1
  );

  const group = db.prepare('SELECT * FROM treatment_groups WHERE id = ?').get(result.lastInsertRowid) as TreatmentGroup;

  res.status(201).json({ success: true, data: group } satisfies ApiResponse<TreatmentGroup>);
});

// PUT /api/experiments/:experimentId/groups/:groupId
experimentsRouter.put('/:experimentId/groups/:groupId', (req, res) => {
  const db = getDatabase();
  const { groupId } = req.params;
  const input: UpdateTreatmentGroupInput = req.body;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
  if (input.color !== undefined) { fields.push('color = ?'); values.push(input.color); }
  if (input.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(input.sort_order); }

  if (fields.length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  values.push(groupId);
  db.prepare(`UPDATE treatment_groups SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const group = db.prepare('SELECT * FROM treatment_groups WHERE id = ?').get(groupId) as TreatmentGroup;
  res.json({ success: true, data: group } satisfies ApiResponse<TreatmentGroup>);
});

// DELETE /api/experiments/:experimentId/groups/:groupId
experimentsRouter.delete('/:experimentId/groups/:groupId', (req, res) => {
  const db = getDatabase();
  const { groupId } = req.params;

  const result = db.prepare('DELETE FROM treatment_groups WHERE id = ?').run(groupId);

  if (result.changes === 0) {
    throw new ApiError(404, 'Treatment group not found');
  }

  res.json({ success: true, message: 'Treatment group deleted' } satisfies ApiResponse<never>);
});

// === Protocol Timepoints ===

// GET /api/experiments/:id/timepoints
experimentsRouter.get('/:id/timepoints', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const timepoints = db.prepare(`
    SELECT id, experiment_id, day_offset, name, description, sample_types, created_at
    FROM protocol_timepoints
    WHERE experiment_id = ?
    ORDER BY day_offset
  `).all(id) as (Omit<ProtocolTimepoint, 'sample_types'> & { sample_types: string })[];

  const parsed: ProtocolTimepoint[] = timepoints.map(tp => ({
    ...tp,
    sample_types: tp.sample_types ? JSON.parse(tp.sample_types) : [],
  }));

  res.json({ success: true, data: parsed } satisfies ApiResponse<ProtocolTimepoint[]>);
});

// POST /api/experiments/:id/timepoints
experimentsRouter.post('/:id/timepoints', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: Omit<CreateProtocolTimepointInput, 'experiment_id'> = req.body;

  if (input.day_offset === undefined || !input.name) {
    throw new ApiError(400, 'day_offset and name are required');
  }

  const result = db.prepare(`
    INSERT INTO protocol_timepoints (experiment_id, day_offset, name, description, sample_types)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    input.day_offset,
    input.name,
    input.description || null,
    input.sample_types ? JSON.stringify(input.sample_types) : null
  );

  const row = db.prepare('SELECT * FROM protocol_timepoints WHERE id = ?').get(result.lastInsertRowid) as
    Omit<ProtocolTimepoint, 'sample_types'> & { sample_types: string };

  const timepoint: ProtocolTimepoint = {
    ...row,
    sample_types: row.sample_types ? JSON.parse(row.sample_types) : [],
  };

  res.status(201).json({ success: true, data: timepoint } satisfies ApiResponse<ProtocolTimepoint>);
});

// PUT /api/experiments/:experimentId/timepoints/:timepointId
experimentsRouter.put('/:experimentId/timepoints/:timepointId', (req, res) => {
  const db = getDatabase();
  const { timepointId } = req.params;
  const input: UpdateProtocolTimepointInput = req.body;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.day_offset !== undefined) { fields.push('day_offset = ?'); values.push(input.day_offset); }
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
  if (input.sample_types !== undefined) { fields.push('sample_types = ?'); values.push(JSON.stringify(input.sample_types)); }

  if (fields.length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  values.push(timepointId);
  db.prepare(`UPDATE protocol_timepoints SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const row = db.prepare('SELECT * FROM protocol_timepoints WHERE id = ?').get(timepointId) as
    Omit<ProtocolTimepoint, 'sample_types'> & { sample_types: string };

  const timepoint: ProtocolTimepoint = {
    ...row,
    sample_types: row.sample_types ? JSON.parse(row.sample_types) : [],
  };

  res.json({ success: true, data: timepoint } satisfies ApiResponse<ProtocolTimepoint>);
});

// DELETE /api/experiments/:experimentId/timepoints/:timepointId
experimentsRouter.delete('/:experimentId/timepoints/:timepointId', (req, res) => {
  const db = getDatabase();
  const { timepointId } = req.params;

  const result = db.prepare('DELETE FROM protocol_timepoints WHERE id = ?').run(timepointId);

  if (result.changes === 0) {
    throw new ApiError(404, 'Protocol timepoint not found');
  }

  res.json({ success: true, message: 'Protocol timepoint deleted' } satisfies ApiResponse<never>);
});
