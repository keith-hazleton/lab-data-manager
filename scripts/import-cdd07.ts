import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001/api';

interface CSVRow {
  SampleID: string;
  sampleType: string;
  MouseSex: string;
  MouseID: string;
  Diet: string;
  Date: string;
  Time: string;
  Vendor: string;
  ExperimentID: string;
  ExperimentDay: string;
  StoolCollected: string;
  BaseWeight: string;
  DayWeight: string;
  PercChange: string;
  Temperature: string;
  StoolScore: string;
  BehaviorScore: string;
  WeightScore: string;
  TotalCSS: string;
  Notes: string;
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header.trim()] = values[i]?.trim() || '';
    });
    return row as unknown as CSVRow;
  });
}

function parseDate(dateStr: string): string {
  // Convert M/D/YY to YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;

  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];

  return `${year}-${month}-${day}`;
}

async function api<T>(endpoint: string, method: string = 'GET', body?: unknown): Promise<T> {
  const maxRetries = 3;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`API error: ${data.error || response.statusText}`);
      }
      return data.data;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  throw lastError;
}

async function main() {
  const csvPath = path.join(process.cwd(), 'CDD07_metadata - Oct 2025.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Loaded ${rows.length} rows from CSV`);

  // Find the start date (first date in the data)
  const dates = [...new Set(rows.map(r => r.Date))].sort((a, b) => {
    return new Date(parseDate(a)).getTime() - new Date(parseDate(b)).getTime();
  });
  const startDate = parseDate(dates[0]);
  console.log(`Experiment start date: ${startDate}`);

  // Create experiment
  console.log('\nCreating experiment...');
  const experiment = await api<{ id: number }>('/experiments', 'POST', {
    name: 'CDD07 Test Experiment',
    description: 'Diet switch experiment with 4 treatment groups',
    start_date: startDate,
    baseline_day_offset: 15, // Day 15 is when CSS scoring starts based on the data
  });
  console.log(`Created experiment with ID: ${experiment.id}`);

  // Treatment groups with colors
  const treatmentGroups = [
    { name: 'HFt/LFb', description: 'High Fat training / Low Fat baseline', color: '#3b82f6' },
    { name: 'HFt/HFb', description: 'High Fat training / High Fat baseline', color: '#ef4444' },
    { name: 'LFt/LFb', description: 'Low Fat training / Low Fat baseline', color: '#22c55e' },
    { name: 'LFt/HFb', description: 'Low Fat training / High Fat baseline', color: '#f59e0b' },
  ];

  console.log('\nCreating treatment groups...');
  const groupMap: Record<string, number> = {};
  for (const group of treatmentGroups) {
    const created = await api<{ id: number }>(`/experiments/${experiment.id}/groups`, 'POST', group);
    groupMap[group.name] = created.id;
    console.log(`  Created treatment group: ${group.name} (ID: ${created.id})`);
  }

  // Get unique mice with their final treatment group
  // Use the last row for each mouse to determine final treatment
  const miceMap = new Map<string, { diet: string; sex: string }>();
  for (const row of rows) {
    if (row.MouseID && row.Diet) {
      miceMap.set(row.MouseID, { diet: row.Diet, sex: row.MouseSex });
    }
  }

  // Create subjects
  console.log('\nCreating subjects...');
  const subjectMap: Record<string, number> = {};

  for (const [mouseId, info] of miceMap) {
    // Parse cage number from MouseID (e.g., CDD07.1.2 -> cage 1)
    const parts = mouseId.split('.');
    const cageNumber = parts[1];
    const earTag = mouseId;

    const subject = await api<{ id: number }>('/subjects', 'POST', {
      experiment_id: experiment.id,
      ear_tag: earTag,
      cage_number: cageNumber,
      treatment_group_id: groupMap[info.diet],
      sex: info.sex.toLowerCase() === 'female' ? 'F' : 'M',
    });
    subjectMap[mouseId] = subject.id;
    console.log(`  Created subject: ${earTag} in cage ${cageNumber} (ID: ${subject.id})`);
  }

  // Create observations - group by date and mouse
  console.log('\nCreating observations...');
  const observationsByKey = new Map<string, CSVRow>();

  for (const row of rows) {
    if (row.DayWeight && row.MouseID) {
      const key = `${row.MouseID}-${row.Date}`;
      observationsByKey.set(key, row);
    }
  }

  let obsCount = 0;
  for (const row of observationsByKey.values()) {
    const subjectId = subjectMap[row.MouseID];
    if (!subjectId) continue;

    const weight = parseFloat(row.DayWeight);
    const stoolScore = row.StoolScore ? parseInt(row.StoolScore) : undefined;
    const behaviorScore = row.BehaviorScore ? parseInt(row.BehaviorScore) : undefined;

    if (!isNaN(weight) || stoolScore !== undefined || behaviorScore !== undefined) {
      await api('/observations', 'POST', {
        subject_id: subjectId,
        observation_date: parseDate(row.Date),
        weight: !isNaN(weight) ? weight : undefined,
        stool_score: stoolScore,
        behavior_score: behaviorScore,
        notes: row.Notes || undefined,
      });
      obsCount++;
    }
  }
  console.log(`  Created ${obsCount} observations`);

  // Create samples for stool collections
  console.log('\nCreating samples...');
  let sampleCount = 0;

  for (const row of rows) {
    if (row.StoolCollected === 'T' && row.MouseID) {
      const subjectId = subjectMap[row.MouseID];
      if (!subjectId) continue;

      await api('/samples', 'POST', {
        subject_id: subjectId,
        sample_type: 'stool',
        collection_date: parseDate(row.Date),
        notes: row.SampleID,
      });
      sampleCount++;
    }
  }
  console.log(`  Created ${sampleCount} samples`);

  console.log('\n✓ Import complete!');
  console.log(`  - 1 experiment`);
  console.log(`  - ${Object.keys(groupMap).length} treatment groups`);
  console.log(`  - ${Object.keys(subjectMap).length} subjects`);
  console.log(`  - ${obsCount} observations`);
  console.log(`  - ${sampleCount} samples`);
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
