import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import { ApiError } from '../middleware/error-handler.js';
import { getTodayDate, calculateDayOfStudy } from '../services/calculations.js';
import type {
  ApiResponse,
  Subject,
  CreateSubjectInput,
  UpdateSubjectInput,
  BatchCreateSubjectsInput,
  SubjectWithLatestObservation,
  CageGroup,
  RecordExitInput,
} from '@lab-data-manager/shared';

export const subjectsRouter = Router();

// GET /api/subjects?experiment_id=X - List subjects for experiment
subjectsRouter.get('/', (req, res) => {
  const db = getDatabase();
  const { experiment_id, status, cage_number, alive_on_date, observation_date } = req.query;

  if (!experiment_id) {
    throw new ApiError(400, 'experiment_id is required');
  }

  // If observation_date is provided, get observations for that date instead of latest
  const obsDateClause = observation_date
    ? `o.observation_date = ?`
    : `o.observation_date = (SELECT MAX(observation_date) FROM observations WHERE subject_id = s.id)`;

  let query = `
    SELECT
      s.*,
      tg.name as treatment_group_name,
      tg.color as treatment_group_color,
      o.observation_date as latest_obs_date,
      o.weight as latest_weight,
      o.weight_pct_change as latest_weight_pct_change,
      o.weight_score as latest_weight_score,
      o.stool_score as latest_stool_score,
      o.behavior_score as latest_behavior_score,
      o.total_css as latest_total_css,
      o.notes as latest_notes
    FROM subjects s
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    LEFT JOIN observations o ON o.subject_id = s.id
      AND ${obsDateClause}
    WHERE s.experiment_id = ?
  `;
  const params: unknown[] = [];
  if (observation_date) {
    params.push(observation_date);
  }
  params.push(experiment_id);

  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }

  // alive_on_date: get subjects that were alive on this date
  // (status = 'alive' OR exit_date is null OR exit_date > the date)
  if (alive_on_date) {
    query += ` AND (s.status = 'alive' OR s.exit_date IS NULL OR s.exit_date >= ?)`;
    params.push(alive_on_date);
  }

  if (cage_number) {
    query += ' AND s.cage_number = ?';
    params.push(cage_number);
  }

  query += ' ORDER BY s.cage_number, s.ear_tag';

  const rows = db.prepare(query).all(...params) as (Subject & {
    treatment_group_name: string;
    treatment_group_color: string | null;
    latest_obs_date: string | null;
    latest_weight: number | null;
    latest_weight_pct_change: number | null;
    latest_weight_score: number | null;
    latest_stool_score: number | null;
    latest_behavior_score: number | null;
    latest_total_css: number | null;
    latest_notes: string | null;
  })[];

  const subjects: SubjectWithLatestObservation[] = rows.map(row => ({
    id: row.id,
    experiment_id: row.experiment_id,
    treatment_group_id: row.treatment_group_id,
    ear_tag: row.ear_tag,
    cage_number: row.cage_number,
    sex: row.sex,
    diet: row.diet,
    date_of_birth: row.date_of_birth,
    baseline_weight: row.baseline_weight,
    status: row.status,
    exit_date: row.exit_date,
    exit_type: row.exit_type,
    exit_reason: row.exit_reason,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    treatment_group_name: row.treatment_group_name,
    treatment_group_color: row.treatment_group_color || undefined,
    latest_observation: row.latest_obs_date ? {
      observation_date: row.latest_obs_date,
      weight: row.latest_weight ?? undefined,
      weight_pct_change: row.latest_weight_pct_change ?? undefined,
      weight_score: row.latest_weight_score ?? undefined,
      stool_score: row.latest_stool_score ?? undefined,
      behavior_score: row.latest_behavior_score ?? undefined,
      total_css: row.latest_total_css ?? undefined,
      notes: row.latest_notes ?? undefined,
    } : undefined,
  }));

  res.json({ success: true, data: subjects } satisfies ApiResponse<SubjectWithLatestObservation[]>);
});

// GET /api/subjects/cages?experiment_id=X - Get subjects grouped by cage
subjectsRouter.get('/cages', (req, res) => {
  const db = getDatabase();
  const { experiment_id } = req.query;
  const today = getTodayDate();

  if (!experiment_id) {
    throw new ApiError(400, 'experiment_id is required');
  }

  const rows = db.prepare(`
    SELECT
      s.*,
      tg.name as treatment_group_name,
      tg.color as treatment_group_color,
      latest_o.observation_date as latest_obs_date,
      latest_o.weight as latest_weight,
      latest_o.weight_pct_change as latest_weight_pct_change,
      latest_o.weight_score as latest_weight_score,
      latest_o.stool_score as latest_stool_score,
      latest_o.behavior_score as latest_behavior_score,
      latest_o.total_css as latest_total_css,
      latest_o.notes as latest_notes,
      CASE WHEN today_o.id IS NOT NULL THEN 1 ELSE 0 END as observed_today
    FROM subjects s
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    LEFT JOIN observations latest_o ON latest_o.subject_id = s.id
      AND latest_o.observation_date = (SELECT MAX(observation_date) FROM observations WHERE subject_id = s.id)
    LEFT JOIN observations today_o ON today_o.subject_id = s.id AND today_o.observation_date = ?
    WHERE s.experiment_id = ?
    ORDER BY s.cage_number, s.ear_tag
  `).all(today, experiment_id) as (Subject & {
    treatment_group_name: string;
    treatment_group_color: string | null;
    latest_obs_date: string | null;
    latest_weight: number | null;
    latest_weight_pct_change: number | null;
    latest_weight_score: number | null;
    latest_stool_score: number | null;
    latest_behavior_score: number | null;
    latest_total_css: number | null;
    latest_notes: string | null;
    observed_today: number;
  })[];

  // Group by cage
  const cageMap = new Map<string, CageGroup>();

  for (const row of rows) {
    const key = row.cage_number;
    if (!cageMap.has(key)) {
      cageMap.set(key, {
        cage_number: row.cage_number,
        experiment_id: row.experiment_id,
        treatment_group_id: row.treatment_group_id,
        treatment_group_name: row.treatment_group_name,
        treatment_group_color: row.treatment_group_color || undefined,
        diet: row.diet || undefined,
        subjects: [],
        total_count: 0,
        alive_count: 0,
        observed_today: 0,
      });
    }

    const cage = cageMap.get(key)!;
    cage.total_count++;
    if (row.status === 'alive') cage.alive_count++;
    if (row.observed_today) cage.observed_today++;

    cage.subjects.push({
      id: row.id,
      experiment_id: row.experiment_id,
      treatment_group_id: row.treatment_group_id,
      ear_tag: row.ear_tag,
      cage_number: row.cage_number,
      sex: row.sex,
      diet: row.diet,
      date_of_birth: row.date_of_birth,
      baseline_weight: row.baseline_weight,
      status: row.status,
      exit_date: row.exit_date,
      exit_type: row.exit_type,
      exit_reason: row.exit_reason,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      treatment_group_name: row.treatment_group_name,
      treatment_group_color: row.treatment_group_color || undefined,
      latest_observation: row.latest_obs_date ? {
        observation_date: row.latest_obs_date,
        weight: row.latest_weight ?? undefined,
        weight_pct_change: row.latest_weight_pct_change ?? undefined,
        weight_score: row.latest_weight_score ?? undefined,
        stool_score: row.latest_stool_score ?? undefined,
        behavior_score: row.latest_behavior_score ?? undefined,
        total_css: row.latest_total_css ?? undefined,
        notes: row.latest_notes ?? undefined,
      } : undefined,
    });
  }

  const cages = Array.from(cageMap.values());
  res.json({ success: true, data: cages } satisfies ApiResponse<CageGroup[]>);
});

// GET /api/subjects/:id - Get single subject
subjectsRouter.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as Subject | undefined;

  if (!subject) {
    throw new ApiError(404, 'Subject not found');
  }

  res.json({ success: true, data: subject } satisfies ApiResponse<Subject>);
});

// POST /api/subjects - Create single subject
subjectsRouter.post('/', (req, res) => {
  const db = getDatabase();
  const input: CreateSubjectInput = req.body;

  if (!input.experiment_id || !input.treatment_group_id || !input.ear_tag || !input.cage_number || !input.sex) {
    throw new ApiError(400, 'experiment_id, treatment_group_id, ear_tag, cage_number, and sex are required');
  }

  const result = db.prepare(`
    INSERT INTO subjects (experiment_id, treatment_group_id, ear_tag, cage_number, sex, diet, date_of_birth, baseline_weight, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.experiment_id,
    input.treatment_group_id,
    input.ear_tag,
    input.cage_number,
    input.sex,
    input.diet || null,
    input.date_of_birth || null,
    input.baseline_weight || null,
    input.notes || null
  );

  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid) as Subject;

  res.status(201).json({ success: true, data: subject } satisfies ApiResponse<Subject>);
});

// POST /api/subjects/batch - Create multiple subjects
subjectsRouter.post('/batch', (req, res) => {
  const db = getDatabase();
  const input: BatchCreateSubjectsInput = req.body;

  if (!input.experiment_id || !input.treatment_group_id || !input.cage_number || !input.sex || !input.count) {
    throw new ApiError(400, 'experiment_id, treatment_group_id, cage_number, sex, and count are required');
  }

  // Use cage number as prefix, start from 1 for each cage
  const prefix = input.ear_tag_prefix ?? `${input.cage_number}.`;
  const startNum = input.ear_tag_start ?? 1;

  const insertStmt = db.prepare(`
    INSERT INTO subjects (experiment_id, treatment_group_id, ear_tag, cage_number, sex, diet, date_of_birth, baseline_weight)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const subjects: Subject[] = [];

  const transaction = db.transaction(() => {
    for (let i = 0; i < input.count; i++) {
      // Zero-pad the number for proper sorting (e.g., A2.01, A2.02, ... A2.10)
      const num = startNum + i;
      const paddedNum = num.toString().padStart(2, '0');
      const earTag = `${prefix}${paddedNum}`;
      const result = insertStmt.run(
        input.experiment_id,
        input.treatment_group_id,
        earTag,
        input.cage_number,
        input.sex,
        input.diet || null,
        input.date_of_birth || null,
        input.baseline_weight || null
      );
      const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid) as Subject;
      subjects.push(subject);
    }
  });

  transaction();

  res.status(201).json({ success: true, data: subjects } satisfies ApiResponse<Subject[]>);
});

// PUT /api/subjects/:id - Update subject
subjectsRouter.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: UpdateSubjectInput = req.body;

  const existing = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
  if (!existing) {
    throw new ApiError(404, 'Subject not found');
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.treatment_group_id !== undefined) { fields.push('treatment_group_id = ?'); values.push(input.treatment_group_id); }
  if (input.ear_tag !== undefined) { fields.push('ear_tag = ?'); values.push(input.ear_tag); }
  if (input.cage_number !== undefined) { fields.push('cage_number = ?'); values.push(input.cage_number); }
  if (input.sex !== undefined) { fields.push('sex = ?'); values.push(input.sex); }
  if (input.diet !== undefined) { fields.push('diet = ?'); values.push(input.diet); }
  if (input.date_of_birth !== undefined) { fields.push('date_of_birth = ?'); values.push(input.date_of_birth); }
  if (input.baseline_weight !== undefined) { fields.push('baseline_weight = ?'); values.push(input.baseline_weight); }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }
  if (input.exit_date !== undefined) { fields.push('exit_date = ?'); values.push(input.exit_date); }
  if (input.exit_type !== undefined) { fields.push('exit_type = ?'); values.push(input.exit_type); }
  if (input.exit_reason !== undefined) { fields.push('exit_reason = ?'); values.push(input.exit_reason); }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }

  if (fields.length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  values.push(id);
  db.prepare(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as Subject;
  res.json({ success: true, data: subject } satisfies ApiResponse<Subject>);
});

// POST /api/subjects/:id/exit - Record death/sacrifice
subjectsRouter.post('/:id/exit', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: RecordExitInput = req.body;

  if (!input.exit_date || !input.exit_type) {
    throw new ApiError(400, 'exit_date and exit_type are required');
  }

  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as Subject | undefined;
  if (!subject) {
    throw new ApiError(404, 'Subject not found');
  }

  // Get experiment for day calculation
  const experiment = db.prepare('SELECT start_date FROM experiments WHERE id = ?').get(subject.experiment_id) as { start_date: string };

  const transaction = db.transaction(() => {
    // Update subject status
    const status = input.exit_type === 'excluded' ? 'excluded' :
      input.exit_type === 'natural_death' ? 'dead' : 'sacrificed';

    db.prepare(`
      UPDATE subjects
      SET status = ?, exit_date = ?, exit_type = ?, exit_reason = ?
      WHERE id = ?
    `).run(status, input.exit_date, input.exit_type, input.exit_reason || null, id);

    // Add final observation if provided
    if (input.final_observation) {
      const dayOfStudy = calculateDayOfStudy(input.exit_date, experiment.start_date);

      db.prepare(`
        INSERT INTO observations (subject_id, observation_date, day_of_study, weight, stool_score, behavior_score, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(subject_id, observation_date) DO UPDATE SET
          weight = excluded.weight,
          stool_score = excluded.stool_score,
          behavior_score = excluded.behavior_score,
          notes = excluded.notes
      `).run(
        id,
        input.exit_date,
        dayOfStudy,
        input.final_observation.weight || null,
        input.final_observation.stool_score ?? null,
        input.final_observation.behavior_score ?? null,
        input.final_observation.notes || null
      );
    }
  });

  transaction();

  const updatedSubject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as Subject;
  res.json({ success: true, data: updatedSubject } satisfies ApiResponse<Subject>);
});

// DELETE /api/subjects/:id
subjectsRouter.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const result = db.prepare('DELETE FROM subjects WHERE id = ?').run(id);

  if (result.changes === 0) {
    throw new ApiError(404, 'Subject not found');
  }

  res.json({ success: true, message: 'Subject deleted' } satisfies ApiResponse<never>);
});

// DELETE /api/subjects/cage/:experimentId/:cageNumber - Delete all subjects in a cage
subjectsRouter.delete('/cage/:experimentId/:cageNumber', (req, res) => {
  const db = getDatabase();
  const { experimentId, cageNumber } = req.params;

  const result = db.prepare(
    'DELETE FROM subjects WHERE experiment_id = ? AND cage_number = ?'
  ).run(experimentId, cageNumber);

  res.json({
    success: true,
    message: `Deleted ${result.changes} subjects from cage ${cageNumber}`
  } satisfies ApiResponse<never>);
});

// PUT /api/subjects/cage/:experimentId/:cageNumber - Update all subjects in a cage
subjectsRouter.put('/cage/:experimentId/:cageNumber', (req, res) => {
  const db = getDatabase();
  const { experimentId, cageNumber } = req.params;
  const { new_cage_number, treatment_group_id, diet } = req.body;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (new_cage_number !== undefined) {
    updates.push('cage_number = ?');
    values.push(new_cage_number);

    // Also update ear_tags to reflect new cage number
    // Get subjects in this cage and update their ear tags
    const subjects = db.prepare(
      'SELECT id, ear_tag FROM subjects WHERE experiment_id = ? AND cage_number = ?'
    ).all(experimentId, cageNumber) as { id: number; ear_tag: string }[];

    for (const subject of subjects) {
      // Replace old cage prefix with new one (e.g., "A1.01" -> "B2.01")
      const parts = subject.ear_tag.split('.');
      if (parts.length === 2) {
        const newEarTag = `${new_cage_number}.${parts[1]}`;
        db.prepare('UPDATE subjects SET ear_tag = ? WHERE id = ?').run(newEarTag, subject.id);
      }
    }
  }

  if (treatment_group_id !== undefined) {
    updates.push('treatment_group_id = ?');
    values.push(treatment_group_id);
  }

  if (diet !== undefined) {
    updates.push('diet = ?');
    values.push(diet);
  }

  if (updates.length > 0) {
    values.push(experimentId, cageNumber);
    db.prepare(
      `UPDATE subjects SET ${updates.join(', ')} WHERE experiment_id = ? AND cage_number = ?`
    ).run(...values);
  }

  // Return updated subjects
  const finalCageNumber = new_cage_number || cageNumber;
  const subjects = db.prepare(
    'SELECT * FROM subjects WHERE experiment_id = ? AND cage_number = ?'
  ).all(experimentId, finalCageNumber) as Subject[];

  res.json({ success: true, data: subjects } satisfies ApiResponse<Subject[]>);
});
