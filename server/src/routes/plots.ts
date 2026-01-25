import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import { calculateDayOfStudy } from '../services/calculations.js';
import type {
  ApiResponse,
  SurvivalCurveData,
  SurvivalDataPoint,
  WeightTimeseriesData,
  CssTimeseriesData,
  SubjectTimeseries,
  TimeseriesDataPoint,
  UnifiedTreatmentGroup,
} from '@lab-data-manager/shared';

export const plotsRouter = Router();

// Parse comma-separated experiment IDs
function parseExperimentIds(param: unknown): number[] {
  if (!param || typeof param !== 'string' || !param.trim()) {
    return [];
  }
  return param.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
}

// GET /api/plots/treatment-groups?experiment_ids=1,2,3
// Get unified treatment groups across experiments
plotsRouter.get('/treatment-groups', (req, res) => {
  const db = getDatabase();
  const experimentIds = parseExperimentIds(req.query.experiment_ids);

  let query = `
    SELECT
      tg.name,
      tg.color,
      e.id as experiment_id,
      COUNT(s.id) as subject_count
    FROM treatment_groups tg
    JOIN experiments e ON e.id = tg.experiment_id
    LEFT JOIN subjects s ON s.treatment_group_id = tg.id
  `;

  const params: unknown[] = [];

  if (experimentIds.length > 0) {
    query += ` WHERE e.id IN (${experimentIds.map(() => '?').join(',')})`;
    params.push(...experimentIds);
  }

  query += ' GROUP BY tg.name, tg.color, e.id ORDER BY tg.name';

  const rows = db.prepare(query).all(...params) as {
    name: string;
    color: string;
    experiment_id: number;
    subject_count: number;
  }[];

  // Aggregate by treatment name
  const groupMap = new Map<string, UnifiedTreatmentGroup>();

  for (const row of rows) {
    if (!groupMap.has(row.name)) {
      groupMap.set(row.name, {
        name: row.name,
        color: row.color,
        experiment_ids: [],
        subject_count: 0,
      });
    }
    const group = groupMap.get(row.name)!;
    if (!group.experiment_ids.includes(row.experiment_id)) {
      group.experiment_ids.push(row.experiment_id);
    }
    group.subject_count += row.subject_count;
  }

  const groups = Array.from(groupMap.values());

  res.json({ success: true, data: groups } satisfies ApiResponse<UnifiedTreatmentGroup[]>);
});

// GET /api/plots/survival?experiment_ids=1,2,3
// Get Kaplan-Meier survival curve data
plotsRouter.get('/survival', (req, res) => {
  const db = getDatabase();
  const experimentIds = parseExperimentIds(req.query.experiment_ids);

  if (experimentIds.length === 0) {
    res.json({ success: true, data: [] } satisfies ApiResponse<SurvivalCurveData[]>);
    return;
  }

  // Get all subjects with their treatment group and exit info
  const subjects = db.prepare(`
    SELECT
      s.id,
      s.status,
      s.exit_date,
      s.exit_type,
      tg.name as treatment_group_name,
      tg.color,
      e.start_date
    FROM subjects s
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    JOIN experiments e ON e.id = s.experiment_id
    WHERE e.id IN (${experimentIds.map(() => '?').join(',')})
  `).all(...experimentIds) as {
    id: number;
    status: string;
    exit_date: string | null;
    exit_type: string | null;
    treatment_group_name: string;
    color: string;
    start_date: string;
  }[];

  // Group subjects by treatment group
  const groupMap = new Map<string, {
    color: string;
    subjects: { exitDay: number | null; isEvent: boolean }[];
  }>();

  for (const subject of subjects) {
    if (!groupMap.has(subject.treatment_group_name)) {
      groupMap.set(subject.treatment_group_name, {
        color: subject.color,
        subjects: [],
      });
    }

    const group = groupMap.get(subject.treatment_group_name)!;
    const exitDay = subject.exit_date
      ? calculateDayOfStudy(subject.exit_date, subject.start_date)
      : null;

    // Deaths are events; sacrifices and exclusions are censored
    const isEvent = subject.exit_type === 'natural_death';

    group.subjects.push({ exitDay, isEvent });
  }

  // Calculate Kaplan-Meier for each group
  const survivalData: SurvivalCurveData[] = [];

  for (const [name, group] of groupMap.entries()) {
    const data = calculateKaplanMeier(group.subjects);
    const totalEvents = group.subjects.filter(s => s.isEvent).length;

    survivalData.push({
      treatment_group_name: name,
      color: group.color,
      data,
      total_subjects: group.subjects.length,
      total_events: totalEvents,
    });
  }

  res.json({ success: true, data: survivalData } satisfies ApiResponse<SurvivalCurveData[]>);
});

// Calculate Kaplan-Meier survival curve
function calculateKaplanMeier(subjects: { exitDay: number | null; isEvent: boolean }[]): SurvivalDataPoint[] {
  // Get all event times sorted
  const events = subjects
    .filter(s => s.exitDay !== null)
    .map(s => ({ day: s.exitDay!, isEvent: s.isEvent }))
    .sort((a, b) => a.day - b.day);

  // Start at day 0 with 100% survival
  const points: SurvivalDataPoint[] = [
    { day_of_study: 0, survival_pct: 100, at_risk: subjects.length, events: 0 },
  ];

  let atRisk = subjects.length;
  let survivalPct = 100;

  // Group events by day
  const eventsByDay = new Map<number, { deaths: number; censored: number }>();
  for (const event of events) {
    if (!eventsByDay.has(event.day)) {
      eventsByDay.set(event.day, { deaths: 0, censored: 0 });
    }
    const dayData = eventsByDay.get(event.day)!;
    if (event.isEvent) {
      dayData.deaths++;
    } else {
      dayData.censored++;
    }
  }

  // Calculate survival at each unique time point
  const sortedDays = Array.from(eventsByDay.keys()).sort((a, b) => a - b);

  for (const day of sortedDays) {
    const { deaths, censored } = eventsByDay.get(day)!;

    if (deaths > 0 && atRisk > 0) {
      // Kaplan-Meier: S(t) = S(t-1) * (1 - d(t)/n(t))
      survivalPct = survivalPct * (1 - deaths / atRisk);
    }

    points.push({
      day_of_study: day,
      survival_pct: Math.max(0, survivalPct),
      at_risk: atRisk - deaths - censored,
      events: deaths,
    });

    atRisk -= deaths + censored;
  }

  return points;
}

// GET /api/plots/weight?experiment_ids=1,2,3&aggregate=median|individual
plotsRouter.get('/weight', (req, res) => {
  const db = getDatabase();
  const experimentIds = parseExperimentIds(req.query.experiment_ids);
  const aggregate = req.query.aggregate === 'individual' ? 'individual' : 'median';

  if (experimentIds.length === 0) {
    res.json({ success: true, data: [] } satisfies ApiResponse<WeightTimeseriesData[]>);
    return;
  }

  // Get all observations with weight data
  const observations = db.prepare(`
    SELECT
      o.subject_id,
      o.day_of_study,
      o.weight,
      s.ear_tag,
      e.name as experiment_name,
      tg.name as treatment_group_name,
      tg.color
    FROM observations o
    JOIN subjects s ON s.id = o.subject_id
    JOIN experiments e ON e.id = s.experiment_id
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    WHERE e.id IN (${experimentIds.map(() => '?').join(',')})
      AND o.weight IS NOT NULL
    ORDER BY tg.name, o.subject_id, o.day_of_study
  `).all(...experimentIds) as {
    subject_id: number;
    day_of_study: number;
    weight: number;
    ear_tag: string;
    experiment_name: string;
    treatment_group_name: string;
    color: string;
  }[];

  // Group by treatment group
  const groupMap = new Map<string, {
    color: string;
    subjects: Map<number, {
      ear_tag: string;
      experiment_name: string;
      data: TimeseriesDataPoint[];
    }>;
  }>();

  for (const obs of observations) {
    if (!groupMap.has(obs.treatment_group_name)) {
      groupMap.set(obs.treatment_group_name, {
        color: obs.color,
        subjects: new Map(),
      });
    }

    const group = groupMap.get(obs.treatment_group_name)!;

    if (!group.subjects.has(obs.subject_id)) {
      group.subjects.set(obs.subject_id, {
        ear_tag: obs.ear_tag,
        experiment_name: obs.experiment_name,
        data: [],
      });
    }

    group.subjects.get(obs.subject_id)!.data.push({
      day_of_study: obs.day_of_study,
      value: obs.weight,
    });
  }

  // Build response
  const weightData: WeightTimeseriesData[] = [];

  for (const [name, group] of groupMap.entries()) {
    if (aggregate === 'individual') {
      // Return individual subject timeseries
      const subjects: SubjectTimeseries[] = [];
      for (const [subjectId, subjectData] of group.subjects.entries()) {
        subjects.push({
          subject_id: subjectId,
          ear_tag: subjectData.ear_tag,
          experiment_name: subjectData.experiment_name,
          treatment_group_name: name,
          color: group.color,
          data: subjectData.data,
        });
      }
      weightData.push({
        treatment_group_name: name,
        color: group.color,
        data: [],
        subjects,
      });
    } else {
      // Calculate median per day
      const dayValues = new Map<number, number[]>();

      for (const subject of group.subjects.values()) {
        for (const point of subject.data) {
          if (!dayValues.has(point.day_of_study)) {
            dayValues.set(point.day_of_study, []);
          }
          dayValues.get(point.day_of_study)!.push(point.value);
        }
      }

      const medianData: TimeseriesDataPoint[] = [];
      for (const [day, values] of Array.from(dayValues.entries()).sort((a, b) => a[0] - b[0])) {
        medianData.push({
          day_of_study: day,
          value: calculateMedian(values),
        });
      }

      weightData.push({
        treatment_group_name: name,
        color: group.color,
        data: medianData,
      });
    }
  }

  res.json({ success: true, data: weightData } satisfies ApiResponse<WeightTimeseriesData[]>);
});

// GET /api/plots/css?experiment_ids=1,2,3&aggregate=median|individual
plotsRouter.get('/css', (req, res) => {
  const db = getDatabase();
  const experimentIds = parseExperimentIds(req.query.experiment_ids);
  const aggregate = req.query.aggregate === 'individual' ? 'individual' : 'median';

  if (experimentIds.length === 0) {
    res.json({ success: true, data: [] } satisfies ApiResponse<CssTimeseriesData[]>);
    return;
  }

  // Get all observations with CSS data
  const observations = db.prepare(`
    SELECT
      o.subject_id,
      o.day_of_study,
      o.total_css,
      s.ear_tag,
      e.name as experiment_name,
      tg.name as treatment_group_name,
      tg.color
    FROM observations o
    JOIN subjects s ON s.id = o.subject_id
    JOIN experiments e ON e.id = s.experiment_id
    JOIN treatment_groups tg ON tg.id = s.treatment_group_id
    WHERE e.id IN (${experimentIds.map(() => '?').join(',')})
      AND o.total_css IS NOT NULL
    ORDER BY tg.name, o.subject_id, o.day_of_study
  `).all(...experimentIds) as {
    subject_id: number;
    day_of_study: number;
    total_css: number;
    ear_tag: string;
    experiment_name: string;
    treatment_group_name: string;
    color: string;
  }[];

  // Group by treatment group
  const groupMap = new Map<string, {
    color: string;
    subjects: Map<number, {
      ear_tag: string;
      experiment_name: string;
      data: TimeseriesDataPoint[];
    }>;
  }>();

  for (const obs of observations) {
    if (!groupMap.has(obs.treatment_group_name)) {
      groupMap.set(obs.treatment_group_name, {
        color: obs.color,
        subjects: new Map(),
      });
    }

    const group = groupMap.get(obs.treatment_group_name)!;

    if (!group.subjects.has(obs.subject_id)) {
      group.subjects.set(obs.subject_id, {
        ear_tag: obs.ear_tag,
        experiment_name: obs.experiment_name,
        data: [],
      });
    }

    group.subjects.get(obs.subject_id)!.data.push({
      day_of_study: obs.day_of_study,
      value: obs.total_css,
    });
  }

  // Build response
  const cssData: CssTimeseriesData[] = [];

  for (const [name, group] of groupMap.entries()) {
    if (aggregate === 'individual') {
      // Return individual subject timeseries
      const subjects: SubjectTimeseries[] = [];
      for (const [subjectId, subjectData] of group.subjects.entries()) {
        subjects.push({
          subject_id: subjectId,
          ear_tag: subjectData.ear_tag,
          experiment_name: subjectData.experiment_name,
          treatment_group_name: name,
          color: group.color,
          data: subjectData.data,
        });
      }
      cssData.push({
        treatment_group_name: name,
        color: group.color,
        data: [],
        subjects,
      });
    } else {
      // Calculate median per day
      const dayValues = new Map<number, number[]>();

      for (const subject of group.subjects.values()) {
        for (const point of subject.data) {
          if (!dayValues.has(point.day_of_study)) {
            dayValues.set(point.day_of_study, []);
          }
          dayValues.get(point.day_of_study)!.push(point.value);
        }
      }

      const medianData: TimeseriesDataPoint[] = [];
      for (const [day, values] of Array.from(dayValues.entries()).sort((a, b) => a[0] - b[0])) {
        medianData.push({
          day_of_study: day,
          value: calculateMedian(values),
        });
      }

      cssData.push({
        treatment_group_name: name,
        color: group.color,
        data: medianData,
      });
    }
  }

  res.json({ success: true, data: cssData } satisfies ApiResponse<CssTimeseriesData[]>);
});

// Calculate median of an array
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
