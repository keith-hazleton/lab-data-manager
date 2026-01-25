/**
 * Seed script to create a test experiment on Day 17 with some alert-triggering data
 * Run with: npx tsx server/src/scripts/seed-test-experiment.ts
 */

import { getDatabase, initializeDatabase } from '../db/connection.js';

function seedTestExperiment() {
  const db = getDatabase();

  // Calculate start date to be 17 days ago
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 17);
  const startDateStr = startDate.toISOString().split('T')[0];

  console.log(`Creating test experiment starting on ${startDateStr} (Day 17 today)`);

  // Create experiment
  const expResult = db.prepare(`
    INSERT INTO experiments (name, description, start_date, endpoint_weight_loss_pct, endpoint_css_threshold, endpoint_css_operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'CDD07 Test - Day 17',
    'Test experiment imported from CSV data for alert testing',
    startDateStr,
    15, // 15% weight loss endpoint
    8,  // CSS >= 8 endpoint
    '>='
  );
  const experimentId = expResult.lastInsertRowid as number;
  console.log(`Created experiment ID: ${experimentId}`);

  // Create treatment groups (based on diet patterns in CSV)
  const groups = [
    { name: 'HFt/LFb', description: 'High Fat treat / Low Fat base', color: '#3b82f6' },
    { name: 'HFt/HFb', description: 'High Fat treat / High Fat base', color: '#ef4444' },
    { name: 'LFt/LFb', description: 'Low Fat treat / Low Fat base', color: '#22c55e' },
    { name: 'LFt/HFb', description: 'Low Fat treat / High Fat base', color: '#f59e0b' },
  ];

  const groupIds: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const result = db.prepare(`
      INSERT INTO treatment_groups (experiment_id, name, description, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(experimentId, g.name, g.description, g.color, i);
    groupIds.push(result.lastInsertRowid as number);
  }
  console.log(`Created ${groupIds.length} treatment groups`);

  // Cage data with mice - based on CSV structure
  // Cage 1 & 2 get group 1 (HFt/LFb), Cage 3 gets group 2 (LFt/LFb), Cage 4 gets group 3 (LFt/HFb)
  // Actually from the Day 17 data:
  // Cage 1: HFt/LFb (group 0)
  // Cage 2: HFt/HFb (group 1)
  // Cage 3: LFt/LFb (group 2)
  // Cage 4: LFt/HFb (group 3)

  const cages = [
    { number: '1', groupIdx: 0, diet: 'HFt/LFb' },
    { number: '2', groupIdx: 1, diet: 'HFt/HFb' },
    { number: '3', groupIdx: 2, diet: 'LFt/LFb' },
    { number: '4', groupIdx: 3, diet: 'LFt/HFb' },
  ];

  // Base weights from CSV Day 15 (baseline)
  const baseWeights: Record<string, number> = {
    '1.1': 18.43, '1.2': 18.30, '1.3': 17.54, '1.4': 17.80, '1.5': 19.75,
    '2.1': 19.68, '2.2': 19.53, '2.3': 19.10, '2.4': 18.98, '2.5': 20.57,
    '3.1': 18.32, '3.2': 21.06, '3.3': 17.78, '3.4': 20.35, '3.5': 19.57,
    '4.1': 20.54, '4.2': 19.90, '4.3': 21.65, '4.4': 21.90, '4.5': 19.78,
  };

  // Day 17 weights from CSV (actual data)
  const day17Weights: Record<string, number> = {
    '1.1': 18.73, '1.2': 19.19, '1.3': 17.75, '1.4': 17.99, '1.5': 20.30,
    '2.1': 20.23, '2.2': 20.33, '2.3': 19.35, '2.4': 20.00, '2.5': 20.65,
    '3.1': 18.53, '3.2': 21.50, '3.3': 18.25, '3.4': 20.35, '3.5': 19.60,
    '4.1': 21.10, '4.2': 19.70, '4.3': 22.20, '4.4': 21.78, '4.5': 20.01,
  };

  // Create subjects and observations
  const subjectIds: Record<string, number> = {};

  for (const cage of cages) {
    for (let mouseNum = 1; mouseNum <= 5; mouseNum++) {
      const earTag = `${cage.number}.${mouseNum.toString().padStart(2, '0')}`;
      const key = `${cage.number}.${mouseNum}`;
      const baseWeight = baseWeights[key];

      const result = db.prepare(`
        INSERT INTO subjects (experiment_id, treatment_group_id, ear_tag, cage_number, sex, diet, baseline_weight)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(experimentId, groupIds[cage.groupIdx], earTag, cage.number, 'F', cage.diet, baseWeight);

      subjectIds[key] = result.lastInsertRowid as number;
    }
  }
  console.log(`Created ${Object.keys(subjectIds).length} subjects`);

  // Add baseline observations (Day 0 = Day 15 in original, but we'll use as baseline)
  // Then add Day 17 observations

  function calculateDayDate(dayOffset: number): string {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dayOffset);
    return d.toISOString().split('T')[0];
  }

  function calculateWeightScore(pctChange: number): number {
    if (pctChange >= 0) return 0;
    if (pctChange >= -4) return 1;
    if (pctChange >= -9) return 2;
    if (pctChange >= -14) return 3;
    return 4;
  }

  // Day 0 observations (baseline - weight only, no CSS)
  const day0Date = calculateDayDate(0);
  for (const [key, subjectId] of Object.entries(subjectIds)) {
    const weight = baseWeights[key];
    db.prepare(`
      INSERT INTO observations (subject_id, observation_date, day_of_study, weight, weight_pct_change, weight_score, stool_score, behavior_score, total_css)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subjectId, day0Date, 0, weight, 0, 0, 0, 0, 0);
  }
  console.log('Added Day 0 observations');

  // Day 15 observations (with CSS scores from CSV)
  const day15Date = calculateDayDate(15);
  const day15Stool: Record<string, number> = {
    '1.1': 4, '1.2': 1, '1.3': 1, '1.4': 4, '1.5': 4,
    '2.1': 1, '2.2': 1, '2.3': 1, '2.4': 0, '2.5': 0,
    '3.1': 1, '3.2': 4, '3.3': 1, '3.4': 1, '3.5': 1,
    '4.1': 1, '4.2': 0, '4.3': 1, '4.4': 0, '4.5': 0,
  };

  for (const [key, subjectId] of Object.entries(subjectIds)) {
    const weight = baseWeights[key]; // Same as baseline
    const stool = day15Stool[key] || 0;
    const totalCss = stool; // No behavior or weight score
    db.prepare(`
      INSERT INTO observations (subject_id, observation_date, day_of_study, weight, weight_pct_change, weight_score, stool_score, behavior_score, total_css)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subjectId, day15Date, 15, weight, 0, 0, stool, 0, totalCss);
  }
  console.log('Added Day 15 observations');

  // Day 16 observations - let's create some concerning trends
  // Modify some mice to have weight loss and higher CSS to test alerts
  const day16Date = calculateDayDate(16);
  const day16Modifications: Record<string, { weightMult: number; stool: number; behavior: number }> = {
    '1.1': { weightMult: 0.92, stool: 3, behavior: 1 },  // -8% weight, CSS=4+3+1=8 (should trigger)
    '1.4': { weightMult: 0.94, stool: 2, behavior: 1 },  // -6% weight, CSS=2+2+1=5
    '3.2': { weightMult: 0.88, stool: 3, behavior: 2 },  // -12% weight, CSS=3+3+2=8 (should trigger)
    '4.2': { weightMult: 0.96, stool: 1, behavior: 0 },  // -4% weight, mild
    '4.5': { weightMult: 0.90, stool: 2, behavior: 2 },  // -10% weight, CSS=3+2+2=7
  };

  for (const [key, subjectId] of Object.entries(subjectIds)) {
    const baseWeight = baseWeights[key];
    const mod = day16Modifications[key];
    let weight: number;
    let stool: number;
    let behavior: number;

    if (mod) {
      weight = baseWeight * mod.weightMult;
      stool = mod.stool;
      behavior = mod.behavior;
    } else {
      // Slight random variation for others
      weight = baseWeight * (0.98 + Math.random() * 0.04); // -2% to +2%
      stool = Math.random() < 0.3 ? 1 : 0;
      behavior = 0;
    }

    const pctChange = ((weight - baseWeight) / baseWeight) * 100;
    const weightScore = calculateWeightScore(pctChange);
    const totalCss = weightScore + stool + behavior;

    db.prepare(`
      INSERT INTO observations (subject_id, observation_date, day_of_study, weight, weight_pct_change, weight_score, stool_score, behavior_score, total_css)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subjectId, day16Date, 16, Math.round(weight * 100) / 100, Math.round(pctChange * 100) / 100, weightScore, stool, behavior, totalCss);
  }
  console.log('Added Day 16 observations (with some alert-triggering data)');

  // Day 17 - today, leave some mice unobserved so you can enter data
  // Only add observations for half the mice
  const day17Date = calculateDayDate(17);
  const observedToday = ['1.2', '1.3', '2.1', '2.2', '2.3', '3.3', '3.4', '3.5', '4.3', '4.4'];

  for (const key of observedToday) {
    const subjectId = subjectIds[key];
    const baseWeight = baseWeights[key];
    const day17Weight = day17Weights[key];
    const pctChange = ((day17Weight - baseWeight) / baseWeight) * 100;
    const weightScore = calculateWeightScore(pctChange);
    const stool = 0;
    const behavior = 0;
    const totalCss = weightScore + stool + behavior;

    db.prepare(`
      INSERT INTO observations (subject_id, observation_date, day_of_study, weight, weight_pct_change, weight_score, stool_score, behavior_score, total_css)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subjectId, day17Date, 17, day17Weight, Math.round(pctChange * 100) / 100, weightScore, stool, behavior, totalCss);
  }
  console.log(`Added Day 17 observations for ${observedToday.length} mice (${Object.keys(subjectIds).length - observedToday.length} still need observations)`);

  console.log('\n=== Test Experiment Created ===');
  console.log(`Experiment: CDD07 Test - Day 17 (ID: ${experimentId})`);
  console.log(`Start date: ${startDateStr}`);
  console.log(`Today is Day 17`);
  console.log('\nMice that should trigger alerts (from Day 16):');
  console.log('- 1.01: ~8% weight loss, CSS=8');
  console.log('- 3.02: ~12% weight loss, CSS=8');
  console.log('- 4.05: ~10% weight loss, CSS=7');
  console.log('\nMice still needing Day 17 observations:');
  const needObs = Object.keys(subjectIds).filter(k => !observedToday.includes(k));
  console.log(needObs.map(k => `${k.split('.')[0]}.${k.split('.')[1].padStart(2, '0')}`).join(', '));
}

// Run
initializeDatabase();
seedTestExperiment();
console.log('\nDone!');
