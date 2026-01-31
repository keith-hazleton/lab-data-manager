import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import { ApiError } from '../middleware/error-handler.js';
import { calculateObservation } from '../services/calculations.js';
import type {
  ApiResponse,
  CssOperator,
} from '@lab-data-manager/shared';

export const syncRouter = Router();

// GET /api/sync/experiment/:id - Download experiment data for offline use
syncRouter.get('/experiment/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const experiment = db.prepare('SELECT * FROM experiments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!experiment) {
    throw new ApiError(404, 'Experiment not found');
  }

  const treatmentGroups = db.prepare(
    'SELECT * FROM treatment_groups WHERE experiment_id = ? ORDER BY sort_order'
  ).all(id);

  const subjects = db.prepare(
    'SELECT * FROM subjects WHERE experiment_id = ? ORDER BY cage_number, ear_tag'
  ).all(id);

  // Observations from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

  const observations = db.prepare(`
    SELECT o.* FROM observations o
    JOIN subjects s ON s.id = o.subject_id
    WHERE s.experiment_id = ? AND o.observation_date >= ?
    ORDER BY o.observation_date DESC
  `).all(id, cutoffDate);

  const samples = db.prepare(`
    SELECT sa.* FROM samples sa
    JOIN subjects s ON s.id = sa.subject_id
    WHERE s.experiment_id = ?
    ORDER BY sa.collection_date DESC
  `).all(id);

  res.json({
    success: true,
    data: {
      experiment,
      treatmentGroups,
      subjects,
      observations,
      samples,
      syncedAt: new Date().toISOString(),
    },
  } satisfies ApiResponse<unknown>);
});

interface SyncMutation {
  id: string;
  type: 'createObservation' | 'createObservationsBatch' | 'recordExit' | 'createSamplesBatch';
  payload: Record<string, unknown>;
  timestamp: number;
}

interface SyncResult {
  id: string;
  success: boolean;
  error?: string;
  conflict?: boolean;
}

// POST /api/sync/push - Push queued mutations from offline
syncRouter.post('/push', (req, res) => {
  const db = getDatabase();
  const { mutations } = req.body as { mutations: SyncMutation[] };

  if (!mutations || !Array.isArray(mutations)) {
    throw new ApiError(400, 'mutations array is required');
  }

  const results: SyncResult[] = [];

  const transaction = db.transaction(() => {
    for (const mutation of mutations) {
      try {
        switch (mutation.type) {
          case 'createObservation': {
            const input = mutation.payload as {
              subject_id: number;
              observation_date: string;
              weight?: number;
              stool_score?: number;
              behavior_score?: number;
              notes?: string;
              observer?: string;
            };

            // Check for conflict: existing observation for same subject+date
            const existing = db.prepare(
              'SELECT id, created_at FROM observations WHERE subject_id = ? AND observation_date = ?'
            ).get(input.subject_id, input.observation_date) as { id: number; created_at: string } | undefined;

            let conflict = false;
            if (existing) {
              // Keep the one with the latest timestamp
              const existingTime = new Date(existing.created_at).getTime();
              if (existingTime > mutation.timestamp) {
                results.push({ id: mutation.id, success: true, conflict: true });
                continue;
              }
              conflict = true;
            }

            // Get subject info for calculations
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
              results.push({ id: mutation.id, success: false, error: 'Subject not found' });
              continue;
            }

            const obsDate = new Date(input.observation_date);
            const startDate = new Date(subjectInfo.start_date);
            const dayOfStudy = Math.floor((obsDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

            let baselineWeight = subjectInfo.baseline_weight;
            if (baselineWeight === null && input.weight !== undefined && dayOfStudy === subjectInfo.baseline_day_offset) {
              db.prepare('UPDATE subjects SET baseline_weight = ? WHERE id = ?')
                .run(input.weight, input.subject_id);
              baselineWeight = input.weight;
            }

            const calculated = calculateObservation(
              input.weight,
              baselineWeight ?? undefined,
              input.stool_score,
              input.behavior_score,
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

            results.push({ id: mutation.id, success: true, conflict });
            break;
          }

          case 'createObservationsBatch': {
            const input = mutation.payload as {
              observation_date: string;
              observations: Array<{
                subject_id: number;
                weight?: number;
                stool_score?: number;
                behavior_score?: number;
                notes?: string;
              }>;
              observer?: string;
            };

            for (const obs of input.observations) {
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
              } | undefined;

              if (!subjectInfo) continue;

              const obsDate = new Date(input.observation_date);
              const startDate = new Date(subjectInfo.start_date);
              const dayOfStudy = Math.floor((obsDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

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
            }

            results.push({ id: mutation.id, success: true });
            break;
          }

          case 'recordExit': {
            const input = mutation.payload as {
              subject_id: number;
              exit_date: string;
              exit_type: string;
              exit_reason?: string;
              final_observation?: {
                weight?: number;
                stool_score?: number;
                behavior_score?: number;
                notes?: string;
              };
            };

            const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(input.subject_id) as Record<string, unknown> | undefined;
            if (!subject) {
              results.push({ id: mutation.id, success: false, error: 'Subject not found' });
              continue;
            }

            const status = input.exit_type === 'excluded' ? 'excluded' :
              input.exit_type === 'natural_death' ? 'dead' : 'sacrificed';

            db.prepare(`
              UPDATE subjects SET status = ?, exit_date = ?, exit_type = ?, exit_reason = ? WHERE id = ?
            `).run(status, input.exit_date, input.exit_type, input.exit_reason || null, input.subject_id);

            if (input.final_observation) {
              const experiment = db.prepare('SELECT start_date FROM experiments WHERE id = ?').get(subject.experiment_id) as { start_date: string };
              const obsDate = new Date(input.exit_date);
              const startDate = new Date(experiment.start_date);
              const dayOfStudy = Math.floor((obsDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

              db.prepare(`
                INSERT INTO observations (subject_id, observation_date, day_of_study, weight, stool_score, behavior_score, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(subject_id, observation_date) DO UPDATE SET
                  weight = excluded.weight, stool_score = excluded.stool_score,
                  behavior_score = excluded.behavior_score, notes = excluded.notes
              `).run(
                input.subject_id,
                input.exit_date,
                dayOfStudy,
                input.final_observation.weight || null,
                input.final_observation.stool_score ?? null,
                input.final_observation.behavior_score ?? null,
                input.final_observation.notes || null
              );
            }

            results.push({ id: mutation.id, success: true });
            break;
          }

          case 'createSamplesBatch': {
            const input = mutation.payload as {
              collection_date: string;
              samples: Array<{ subject_id: number; sample_type: string }>;
            };

            for (const sample of input.samples) {
              const subjectInfo = db.prepare(`
                SELECT s.experiment_id, e.start_date FROM subjects s
                JOIN experiments e ON e.id = s.experiment_id
                WHERE s.id = ?
              `).get(sample.subject_id) as { experiment_id: number; start_date: string } | undefined;

              if (!subjectInfo) continue;

              const obsDate = new Date(input.collection_date);
              const startDate = new Date(subjectInfo.start_date);
              const dayOfStudy = Math.floor((obsDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

              db.prepare(`
                INSERT INTO samples (subject_id, sample_type, collection_date, day_of_study)
                VALUES (?, ?, ?, ?)
              `).run(sample.subject_id, sample.sample_type, input.collection_date, dayOfStudy);
            }

            results.push({ id: mutation.id, success: true });
            break;
          }

          default:
            results.push({ id: mutation.id, success: false, error: `Unknown mutation type: ${mutation.type}` });
        }
      } catch (err) {
        results.push({
          id: mutation.id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  });

  transaction();

  res.json({ success: true, data: results } satisfies ApiResponse<SyncResult[]>);
});
