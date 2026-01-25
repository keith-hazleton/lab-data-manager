import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import { ApiError } from '../middleware/error-handler.js';
import { calculateObservation } from '../services/calculations.js';
import { checkEndpointAlerts } from '../services/alerts.js';
import type {
  ApiResponse,
  Observation,
  ObservationResponse,
  CreateObservationInput,
  UpdateObservationInput,
  BatchCreateObservationsInput,
  ObservationWithSubject,
  DailyObservationSummary,
  CssOperator,
} from '@lab-data-manager/shared';

export const observationsRouter = Router();

// GET /api/observations?subject_id=X or experiment_id=X&date=Y
observationsRouter.get('/', (req, res) => {
  const db = getDatabase();
  const { subject_id, experiment_id, date, start_date, end_date } = req.query;

  if (!subject_id && !experiment_id) {
    throw new ApiError(400, 'subject_id or experiment_id is required');
  }

  let query: string;
  const params: unknown[] = [];

  if (subject_id) {
    query = 'SELECT * FROM observations WHERE subject_id = ?';
    params.push(subject_id);

    if (date) {
      query += ' AND observation_date = ?';
      params.push(date);
    }

    query += ' ORDER BY observation_date DESC';
  } else {
    query = `
      SELECT
        o.*,
        s.ear_tag,
        s.cage_number,
        tg.name as treatment_group_name
      FROM observations o
      JOIN subjects s ON s.id = o.subject_id
      JOIN treatment_groups tg ON tg.id = s.treatment_group_id
      WHERE s.experiment_id = ?
    `;
    params.push(experiment_id);

    if (date) {
      query += ' AND o.observation_date = ?';
      params.push(date);
    } else if (start_date && end_date) {
      query += ' AND o.observation_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY o.observation_date DESC, s.cage_number, s.ear_tag';
  }

  const observations = db.prepare(query).all(...params) as (Observation | ObservationWithSubject)[];

  res.json({ success: true, data: observations } satisfies ApiResponse<(Observation | ObservationWithSubject)[]>);
});

// GET /api/observations/summary?experiment_id=X - Daily summary for all days
observationsRouter.get('/summary', (req, res) => {
  const db = getDatabase();
  const { experiment_id } = req.query;

  if (!experiment_id) {
    throw new ApiError(400, 'experiment_id is required');
  }

  // Get experiment info
  const experiment = db.prepare(`
    SELECT start_date FROM experiments WHERE id = ?
  `).get(experiment_id) as { start_date: string } | undefined;

  if (!experiment) {
    throw new ApiError(404, 'Experiment not found');
  }

  // Get protocol timepoints
  const timepoints = db.prepare(`
    SELECT day_offset, name FROM protocol_timepoints WHERE experiment_id = ?
  `).all(experiment_id) as { day_offset: number; name: string }[];
  const timepointMap = new Map(timepoints.map(t => [t.day_offset, t.name]));

  // Get current alive count
  const aliveCount = db.prepare(`
    SELECT COUNT(*) as total FROM subjects WHERE experiment_id = ? AND status = 'alive'
  `).get(experiment_id) as { total: number };

  // Generate all dates from start_date to today
  const startDate = new Date(experiment.start_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);

  const dates: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= today) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Get observation counts per day
  const observationCounts = db.prepare(`
    SELECT
      o.observation_date as date,
      COUNT(DISTINCT o.subject_id) as observed_count,
      SUM(CASE WHEN o.total_css >= 8 OR o.weight_pct_change <= -15 THEN 1 ELSE 0 END) as alerts_count
    FROM observations o
    JOIN subjects s ON s.id = o.subject_id
    WHERE s.experiment_id = ?
    GROUP BY o.observation_date
  `).all(experiment_id) as { date: string; observed_count: number; alerts_count: number }[];
  const obsMap = new Map(observationCounts.map(o => [o.date, o]));

  // Get sample counts per day
  const sampleCounts = db.prepare(`
    SELECT
      sa.collection_date as date,
      COUNT(*) as samples_collected
    FROM samples sa
    JOIN subjects s ON s.id = sa.subject_id
    WHERE s.experiment_id = ?
    GROUP BY sa.collection_date
  `).all(experiment_id) as { date: string; samples_collected: number }[];
  const sampleMap = new Map(sampleCounts.map(s => [s.date, s.samples_collected]));

  // Build summary for each date
  const summary: DailyObservationSummary[] = dates.map(date => {
    const dayOfStudy = Math.floor((new Date(date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const obs = obsMap.get(date);
    const samplesCollected = sampleMap.get(date) || 0;
    const timepointName = timepointMap.get(dayOfStudy);

    return {
      date,
      day_of_study: dayOfStudy,
      total_subjects: aliveCount.total,
      observed_count: obs?.observed_count || 0,
      pending_count: aliveCount.total - (obs?.observed_count || 0),
      alerts_count: obs?.alerts_count || 0,
      timepoint_name: timepointName,
      samples_collected: samplesCollected,
    };
  });

  // Return in reverse chronological order (most recent first)
  summary.reverse();

  res.json({ success: true, data: summary } satisfies ApiResponse<DailyObservationSummary[]>);
});

// GET /api/observations/alerts?experiment_id=X&date=Y - Get mice with alerts
observationsRouter.get('/alerts', (req, res) => {
  const db = getDatabase();
  const { experiment_id, date } = req.query;

  if (!experiment_id) {
    throw new ApiError(400, 'experiment_id is required');
  }

  // Get experiment thresholds
  const experiment = db.prepare(`
    SELECT endpoint_weight_loss_pct, endpoint_css_threshold, endpoint_css_operator
    FROM experiments WHERE id = ?
  `).get(experiment_id) as {
    endpoint_weight_loss_pct: number;
    endpoint_css_threshold: number | null;
    endpoint_css_operator: string | null;
  } | undefined;

  if (!experiment) {
    throw new ApiError(404, 'Experiment not found');
  }

  const weightThreshold = experiment.endpoint_weight_loss_pct;
  const cssThreshold = experiment.endpoint_css_threshold ?? 8;

  // Get observations with alerts (CSS >= threshold OR weight loss >= threshold)
  const query = `
    SELECT
      o.*,
      s.ear_tag,
      s.cage_number,
      s.baseline_weight,
      tg.name as treatment_group_name,
      tg.color as treatment_group_color
    FROM observations o
    JOIN subjects s ON s.id = o.subject_id
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    WHERE s.experiment_id = ?
      AND s.status = 'alive'
      ${date ? 'AND o.observation_date = ?' : `AND o.observation_date = (
        SELECT MAX(o2.observation_date) FROM observations o2 WHERE o2.subject_id = o.subject_id
      )`}
      AND (
        o.total_css >= ?
        OR (o.weight_pct_change IS NOT NULL AND o.weight_pct_change <= ?)
      )
    ORDER BY o.total_css DESC, o.weight_pct_change ASC
  `;

  const params = date
    ? [experiment_id, date, cssThreshold, -weightThreshold]
    : [experiment_id, cssThreshold, -weightThreshold];

  const alerts = db.prepare(query).all(...params) as (Observation & {
    ear_tag: string;
    cage_number: string;
    baseline_weight: number | null;
    treatment_group_name: string;
    treatment_group_color: string | null;
  })[];

  // Add alert reasons
  const alertsWithReasons = alerts.map(obs => {
    const reasons: string[] = [];
    const css = obs.total_css;
    const weightChange = obs.weight_pct_change;

    if (css !== null && css !== undefined && css >= cssThreshold) {
      reasons.push(`CSS ${css} (threshold: ${cssThreshold})`);
    }
    if (weightChange !== null && weightChange !== undefined && weightChange <= -weightThreshold) {
      reasons.push(`Weight ${weightChange.toFixed(1)}% (threshold: -${weightThreshold}%)`);
    } else if (weightChange !== null && weightChange !== undefined && weightChange <= -(weightThreshold - 5)) {
      reasons.push(`Weight ${weightChange.toFixed(1)}% (approaching -${weightThreshold}%)`);
    }
    return { ...obs, alert_reasons: reasons };
  });

  res.json({ success: true, data: alertsWithReasons });
});

// GET /api/observations/:id
observationsRouter.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const observation = db.prepare('SELECT * FROM observations WHERE id = ?').get(id) as Observation | undefined;

  if (!observation) {
    throw new ApiError(404, 'Observation not found');
  }

  res.json({ success: true, data: observation } satisfies ApiResponse<Observation>);
});

// POST /api/observations - Create observation with auto-calculations
observationsRouter.post('/', (req, res) => {
  const db = getDatabase();
  const input: CreateObservationInput = req.body;

  if (!input.subject_id || !input.observation_date) {
    throw new ApiError(400, 'subject_id and observation_date are required');
  }

  // Get subject and experiment info for calculations
  const subjectInfo = db.prepare(`
    SELECT s.baseline_weight, e.start_date, e.baseline_day_offset,
           e.endpoint_weight_loss_pct, e.endpoint_css_threshold, e.endpoint_css_operator
    FROM subjects s
    JOIN experiments e ON e.id = s.experiment_id
    WHERE s.id = ?
  `).get(input.subject_id) as {
    baseline_weight: number | null;
    start_date: string;
    baseline_day_offset: number;
    endpoint_weight_loss_pct: number;
    endpoint_css_threshold: number | null;
    endpoint_css_operator: CssOperator | null;
  } | undefined;

  if (!subjectInfo) {
    throw new ApiError(404, 'Subject not found');
  }

  // Calculate day of study to check if we're on the baseline day
  const obsDate = new Date(input.observation_date);
  const startDate = new Date(subjectInfo.start_date);
  const dayOfStudy = Math.floor((obsDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Auto-set baseline weight from observation on baseline day
  let baselineWeight = subjectInfo.baseline_weight;
  if (baselineWeight === null && input.weight !== undefined && dayOfStudy === subjectInfo.baseline_day_offset) {
    db.prepare('UPDATE subjects SET baseline_weight = ? WHERE id = ?')
      .run(input.weight, input.subject_id);
    baselineWeight = input.weight;
  }

  // Calculate derived fields
  const calculated = calculateObservation(
    input.weight,
    baselineWeight ?? undefined,
    input.stool_score,
    input.behavior_score,
    input.observation_date,
    subjectInfo.start_date,
    subjectInfo.baseline_day_offset
  );

  const result = db.prepare(`
    INSERT INTO observations (
      subject_id, observation_date, day_of_study, weight,
      weight_pct_change, weight_score, stool_score, behavior_score,
      total_css, notes, observer
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(subject_id, observation_date) DO UPDATE SET
      weight = excluded.weight,
      weight_pct_change = excluded.weight_pct_change,
      weight_score = excluded.weight_score,
      stool_score = excluded.stool_score,
      behavior_score = excluded.behavior_score,
      total_css = excluded.total_css,
      notes = excluded.notes,
      observer = excluded.observer
  `).run(
    input.subject_id,
    input.observation_date,
    calculated.day_of_study,
    input.weight ?? null,
    calculated.weight_pct_change,
    calculated.weight_score,
    input.stool_score ?? null,
    input.behavior_score ?? null,
    calculated.total_css,
    input.notes || null,
    input.observer || null
  );

  // Get the created/updated observation
  const observation = db.prepare(`
    SELECT * FROM observations
    WHERE subject_id = ? AND observation_date = ?
  `).get(input.subject_id, input.observation_date) as Observation;

  // Check for endpoint alerts
  const alerts = checkEndpointAlerts({
    weightPctChange: calculated.weight_pct_change,
    totalCss: calculated.total_css,
    endpointWeightLossPct: subjectInfo.endpoint_weight_loss_pct,
    endpointCssThreshold: subjectInfo.endpoint_css_threshold,
    endpointCssOperator: subjectInfo.endpoint_css_operator,
  });

  const response: ObservationResponse = {
    ...observation,
    alerts,
  };

  res.status(result.changes > 0 ? 200 : 201).json({
    success: true,
    data: response
  } satisfies ApiResponse<ObservationResponse>);
});

// POST /api/observations/batch - Create multiple observations
observationsRouter.post('/batch', (req, res) => {
  const db = getDatabase();
  const input: BatchCreateObservationsInput = req.body;

  if (!input.observation_date || !input.observations?.length) {
    throw new ApiError(400, 'observation_date and observations array are required');
  }

  const results: ObservationResponse[] = [];

  const transaction = db.transaction(() => {
    for (const obs of input.observations) {
      // Get subject and experiment info
      const subjectInfo = db.prepare(`
        SELECT s.baseline_weight, e.start_date, e.baseline_day_offset,
               e.endpoint_weight_loss_pct, e.endpoint_css_threshold, e.endpoint_css_operator
        FROM subjects s
        JOIN experiments e ON e.id = s.experiment_id
        WHERE s.id = ?
      `).get(obs.subject_id) as {
        baseline_weight: number | null;
        start_date: string;
        baseline_day_offset: number;
        endpoint_weight_loss_pct: number;
        endpoint_css_threshold: number | null;
        endpoint_css_operator: CssOperator | null;
      } | undefined;

      if (!subjectInfo) continue;

      // Calculate day of study to check if we're on the baseline day
      const obsDate = new Date(input.observation_date);
      const startDate = new Date(subjectInfo.start_date);
      const dayOfStudy = Math.floor((obsDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Auto-set baseline weight from observation on baseline day
      let baselineWeight = subjectInfo.baseline_weight;
      if (baselineWeight === null && obs.weight !== undefined && dayOfStudy === subjectInfo.baseline_day_offset) {
        db.prepare('UPDATE subjects SET baseline_weight = ? WHERE id = ?')
          .run(obs.weight, obs.subject_id);
        baselineWeight = obs.weight;
      }

      const calculated = calculateObservation(
        obs.weight,
        baselineWeight ?? undefined,
        obs.stool_score,
        obs.behavior_score,
        input.observation_date,
        subjectInfo.start_date,
        subjectInfo.baseline_day_offset
      );

      db.prepare(`
        INSERT INTO observations (
          subject_id, observation_date, day_of_study, weight,
          weight_pct_change, weight_score, stool_score, behavior_score,
          total_css, notes, observer
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(subject_id, observation_date) DO UPDATE SET
          weight = excluded.weight,
          weight_pct_change = excluded.weight_pct_change,
          weight_score = excluded.weight_score,
          stool_score = excluded.stool_score,
          behavior_score = excluded.behavior_score,
          total_css = excluded.total_css,
          notes = excluded.notes,
          observer = excluded.observer
      `).run(
        obs.subject_id,
        input.observation_date,
        calculated.day_of_study,
        obs.weight ?? null,
        calculated.weight_pct_change,
        calculated.weight_score,
        obs.stool_score ?? null,
        obs.behavior_score ?? null,
        calculated.total_css,
        obs.notes || null,
        input.observer || null
      );

      const observation = db.prepare(`
        SELECT * FROM observations
        WHERE subject_id = ? AND observation_date = ?
      `).get(obs.subject_id, input.observation_date) as Observation;

      const alerts = checkEndpointAlerts({
        weightPctChange: calculated.weight_pct_change,
        totalCss: calculated.total_css,
        endpointWeightLossPct: subjectInfo.endpoint_weight_loss_pct,
        endpointCssThreshold: subjectInfo.endpoint_css_threshold,
        endpointCssOperator: subjectInfo.endpoint_css_operator,
      });

      results.push({ ...observation, alerts });
    }
  });

  transaction();

  res.status(201).json({ success: true, data: results } satisfies ApiResponse<ObservationResponse[]>);
});

// PUT /api/observations/:id
observationsRouter.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: UpdateObservationInput = req.body;

  const existing = db.prepare('SELECT * FROM observations WHERE id = ?').get(id) as Observation | undefined;
  if (!existing) {
    throw new ApiError(404, 'Observation not found');
  }

  // If weight or scores changed, recalculate
  const needsRecalc = input.weight !== undefined ||
    input.stool_score !== undefined ||
    input.behavior_score !== undefined;

  if (needsRecalc) {
    const subjectInfo = db.prepare(`
      SELECT s.baseline_weight, e.start_date, e.baseline_day_offset
      FROM subjects s
      JOIN experiments e ON e.id = s.experiment_id
      WHERE s.id = ?
    `).get(existing.subject_id) as { baseline_weight: number | null; start_date: string; baseline_day_offset: number };

    const weight = input.weight ?? existing.weight;
    const stoolScore = input.stool_score ?? existing.stool_score;
    const behaviorScore = input.behavior_score ?? existing.behavior_score;
    const obsDate = input.observation_date ?? existing.observation_date;

    const calculated = calculateObservation(
      weight ?? undefined,
      subjectInfo.baseline_weight ?? undefined,
      stoolScore ?? undefined,
      behaviorScore ?? undefined,
      obsDate,
      subjectInfo.start_date,
      subjectInfo.baseline_day_offset
    );

    db.prepare(`
      UPDATE observations SET
        observation_date = ?,
        day_of_study = ?,
        weight = ?,
        weight_pct_change = ?,
        weight_score = ?,
        stool_score = ?,
        behavior_score = ?,
        total_css = ?,
        notes = ?,
        observer = ?
      WHERE id = ?
    `).run(
      obsDate,
      calculated.day_of_study,
      weight ?? null,
      calculated.weight_pct_change,
      calculated.weight_score,
      stoolScore ?? null,
      behaviorScore ?? null,
      calculated.total_css,
      input.notes ?? existing.notes,
      input.observer ?? existing.observer,
      id
    );
  } else {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.observation_date !== undefined) { fields.push('observation_date = ?'); values.push(input.observation_date); }
    if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }
    if (input.observer !== undefined) { fields.push('observer = ?'); values.push(input.observer); }

    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE observations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  const observation = db.prepare('SELECT * FROM observations WHERE id = ?').get(id) as Observation;
  res.json({ success: true, data: observation } satisfies ApiResponse<Observation>);
});

// DELETE /api/observations/:id
observationsRouter.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const result = db.prepare('DELETE FROM observations WHERE id = ?').run(id);

  if (result.changes === 0) {
    throw new ApiError(404, 'Observation not found');
  }

  res.json({ success: true, message: 'Observation deleted' } satisfies ApiResponse<never>);
});
