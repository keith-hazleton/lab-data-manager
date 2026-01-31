import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface SyncQueueItem {
  id: string;
  type: 'createObservation' | 'createObservationsBatch' | 'recordExit' | 'createSamplesBatch';
  payload: Record<string, unknown>;
  timestamp: number;
  experimentId: number;
}

interface SyncMeta {
  experimentId: number;
  lastSync: string;
  subjectCount: number;
}

interface OfflineDBSchema extends DBSchema {
  experiments: {
    key: number;
    value: Record<string, unknown>;
  };
  treatmentGroups: {
    key: number;
    value: Record<string, unknown>;
    indexes: { 'by-experiment': number };
  };
  subjects: {
    key: number;
    value: Record<string, unknown>;
    indexes: { 'by-experiment': number; 'by-cage': [number, string] };
  };
  observations: {
    key: number;
    value: Record<string, unknown>;
    indexes: { 'by-subject': number; 'by-experiment-date': [number, string] };
  };
  samples: {
    key: number;
    value: Record<string, unknown>;
    indexes: { 'by-experiment': number };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-timestamp': number };
  };
  syncMeta: {
    key: number;
    value: SyncMeta;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDBSchema>('lab-data-offline', 1, {
      upgrade(db) {
        db.createObjectStore('experiments', { keyPath: 'id' });

        const tgStore = db.createObjectStore('treatmentGroups', { keyPath: 'id' });
        tgStore.createIndex('by-experiment', 'experiment_id');

        const subjectStore = db.createObjectStore('subjects', { keyPath: 'id' });
        subjectStore.createIndex('by-experiment', 'experiment_id');
        subjectStore.createIndex('by-cage', ['experiment_id', 'cage_number']);

        const obsStore = db.createObjectStore('observations', { keyPath: 'id' });
        obsStore.createIndex('by-subject', 'subject_id');
        obsStore.createIndex('by-experiment-date', ['_experiment_id', 'observation_date']);

        const sampleStore = db.createObjectStore('samples', { keyPath: 'id' });
        sampleStore.createIndex('by-experiment', '_experiment_id');

        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('by-timestamp', 'timestamp');

        db.createObjectStore('syncMeta', { keyPath: 'experimentId' });
      },
    });
  }
  return dbPromise;
}

// Store full experiment data from sync endpoint
export async function storeExperimentData(data: {
  experiment: Record<string, unknown>;
  treatmentGroups: Record<string, unknown>[];
  subjects: Record<string, unknown>[];
  observations: Record<string, unknown>[];
  samples: Record<string, unknown>[];
  syncedAt: string;
}) {
  const db = await getDB();
  const expId = data.experiment.id as number;

  const tx = db.transaction(
    ['experiments', 'treatmentGroups', 'subjects', 'observations', 'samples', 'syncMeta'],
    'readwrite'
  );

  // Store experiment
  await tx.objectStore('experiments').put(data.experiment);

  // Clear old data for this experiment, then store new
  // Treatment groups
  const tgStore = tx.objectStore('treatmentGroups');
  const oldTGs = await tgStore.index('by-experiment').getAllKeys(expId);
  for (const key of oldTGs) await tgStore.delete(key);
  for (const tg of data.treatmentGroups) await tgStore.put(tg);

  // Subjects
  const subStore = tx.objectStore('subjects');
  const oldSubs = await subStore.index('by-experiment').getAllKeys(expId);
  for (const key of oldSubs) await subStore.delete(key);
  for (const sub of data.subjects) await subStore.put(sub);

  // Observations - tag with _experiment_id for indexing
  const obsStore = tx.objectStore('observations');
  // Build subject->experiment map
  const subjectExpMap = new Map<number, number>();
  for (const sub of data.subjects) {
    subjectExpMap.set(sub.id as number, sub.experiment_id as number);
  }
  // Delete old observations for subjects in this experiment
  const oldObs = await obsStore.index('by-experiment-date').getAllKeys(
    IDBKeyRange.bound([expId, ''], [expId, '\uffff'])
  );
  for (const key of oldObs) await obsStore.delete(key);
  for (const obs of data.observations) {
    const subId = obs.subject_id as number;
    await obsStore.put({ ...obs, _experiment_id: subjectExpMap.get(subId) ?? expId });
  }

  // Samples
  const sampleStore = tx.objectStore('samples');
  const oldSamples = await sampleStore.index('by-experiment').getAllKeys(expId);
  for (const key of oldSamples) await sampleStore.delete(key);
  for (const sample of data.samples) {
    const subId = sample.subject_id as number;
    await sampleStore.put({ ...sample, _experiment_id: subjectExpMap.get(subId) ?? expId });
  }

  // Update sync meta
  await tx.objectStore('syncMeta').put({
    experimentId: expId,
    lastSync: data.syncedAt,
    subjectCount: data.subjects.length,
  });

  await tx.done;
}

// Read helpers
export async function getExperiment(id: number) {
  const db = await getDB();
  return db.get('experiments', id);
}

export async function getTreatmentGroups(experimentId: number) {
  const db = await getDB();
  return db.getAllFromIndex('treatmentGroups', 'by-experiment', experimentId);
}

export async function getSubjects(
  experimentId: number,
  filters?: { status?: string; cage_number?: string }
) {
  const db = await getDB();
  let subjects = await db.getAllFromIndex('subjects', 'by-experiment', experimentId);

  if (filters?.status) {
    subjects = subjects.filter(s => s.status === filters.status);
  }
  if (filters?.cage_number) {
    subjects = subjects.filter(s => s.cage_number === filters.cage_number);
  }

  return subjects;
}

export async function getSubjectsWithLatestObs(
  experimentId: number,
  filters?: { status?: string; cage_number?: string; observation_date?: string }
) {
  const db = await getDB();
  let subjects = await db.getAllFromIndex('subjects', 'by-experiment', experimentId);

  if (filters?.status) {
    subjects = subjects.filter(s => s.status === filters.status);
  }
  if (filters?.cage_number) {
    subjects = subjects.filter(s => s.cage_number === filters.cage_number);
  }

  // Attach latest observation for each subject
  const result = [];
  for (const sub of subjects) {
    const subId = sub.id as number;
    const allObs = await db.getAllFromIndex('observations', 'by-subject', subId);

    // Sort by date descending
    allObs.sort((a, b) => {
      const dateA = a.observation_date as string;
      const dateB = b.observation_date as string;
      return dateB.localeCompare(dateA);
    });

    // If observation_date filter, find that specific observation
    let latestObs = allObs[0];
    if (filters?.observation_date) {
      latestObs = allObs.find(o => o.observation_date === filters.observation_date) || allObs[0];
    }

    const tgs = await db.getAllFromIndex('treatmentGroups', 'by-experiment', experimentId);
    const tg = tgs.find(t => t.id === sub.treatment_group_id);

    result.push({
      ...sub,
      treatment_group_name: tg?.name || '',
      treatment_group_color: tg?.color || undefined,
      latest_observation: latestObs ? {
        observation_date: latestObs.observation_date,
        weight: latestObs.weight ?? undefined,
        weight_pct_change: latestObs.weight_pct_change ?? undefined,
        weight_score: latestObs.weight_score ?? undefined,
        stool_score: latestObs.stool_score ?? undefined,
        behavior_score: latestObs.behavior_score ?? undefined,
        total_css: latestObs.total_css ?? undefined,
        notes: latestObs.notes ?? undefined,
      } : undefined,
    });
  }

  return result;
}

export async function getCages(experimentId: number) {
  const db = await getDB();
  const subjects = await db.getAllFromIndex('subjects', 'by-experiment', experimentId);
  const tgs = await db.getAllFromIndex('treatmentGroups', 'by-experiment', experimentId);

  const today = new Date().toISOString().split('T')[0];

  // Group by cage
  const cageMap = new Map<string, Record<string, unknown>>();

  for (const sub of subjects) {
    const key = sub.cage_number as string;
    if (!cageMap.has(key)) {
      const tg = tgs.find(t => t.id === sub.treatment_group_id);
      cageMap.set(key, {
        cage_number: key,
        experiment_id: experimentId,
        treatment_group_id: sub.treatment_group_id,
        treatment_group_name: tg?.name || '',
        treatment_group_color: tg?.color || undefined,
        diet: sub.diet || undefined,
        subjects: [],
        total_count: 0,
        alive_count: 0,
        observed_today: 0,
      });
    }

    const cage = cageMap.get(key)!;
    (cage.total_count as number)++;
    if (sub.status === 'alive') (cage.alive_count as number)++;

    // Check if observed today
    const allObs = await db.getAllFromIndex('observations', 'by-subject', sub.id as number);
    const todayObs = allObs.find(o => o.observation_date === today);
    if (todayObs) (cage.observed_today as number)++;

    const tg = tgs.find(t => t.id === sub.treatment_group_id);
    const latestObs = allObs.sort((a, b) =>
      (b.observation_date as string).localeCompare(a.observation_date as string)
    )[0];

    (cage.subjects as Record<string, unknown>[]).push({
      ...sub,
      treatment_group_name: tg?.name || '',
      treatment_group_color: tg?.color || undefined,
      latest_observation: latestObs ? {
        observation_date: latestObs.observation_date,
        weight: latestObs.weight ?? undefined,
        weight_pct_change: latestObs.weight_pct_change ?? undefined,
        weight_score: latestObs.weight_score ?? undefined,
        stool_score: latestObs.stool_score ?? undefined,
        behavior_score: latestObs.behavior_score ?? undefined,
        total_css: latestObs.total_css ?? undefined,
        notes: latestObs.notes ?? undefined,
      } : undefined,
    });
  }

  return Array.from(cageMap.values());
}

export async function getObservations(experimentId: number, date?: string) {
  const db = await getDB();
  if (date) {
    return db.getAllFromIndex('observations', 'by-experiment-date', [experimentId, date]);
  }
  // Get all for experiment
  const allObs = await db.getAllFromIndex('observations', 'by-experiment-date',
    IDBKeyRange.bound([experimentId, ''], [experimentId, '\uffff'])
  );
  return allObs;
}

// Sync queue operations
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>) {
  const db = await getDB();
  const queueItem: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  await db.put('syncQueue', queueItem);
  return queueItem;
}

export async function getSyncQueue() {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-timestamp');
}

export async function getSyncQueueCount() {
  const db = await getDB();
  return db.count('syncQueue');
}

export async function removeSyncQueueItems(ids: string[]) {
  const db = await getDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
}

export async function getSyncMeta(experimentId: number): Promise<SyncMeta | undefined> {
  const db = await getDB();
  return db.get('syncMeta', experimentId);
}

// Write optimistic data to IndexedDB cache
export async function writeOptimisticObservation(
  experimentId: number,
  observation: Record<string, unknown>
) {
  const db = await getDB();
  // Generate a temporary negative ID to distinguish from server IDs
  const tempId = -Date.now();
  await db.put('observations', {
    ...observation,
    id: tempId,
    _experiment_id: experimentId,
  });
}

export async function writeOptimisticSubjectUpdate(
  subjectId: number,
  updates: Record<string, unknown>
) {
  const db = await getDB();
  const existing = await db.get('subjects', subjectId);
  if (existing) {
    await db.put('subjects', { ...existing, ...updates });
  }
}
