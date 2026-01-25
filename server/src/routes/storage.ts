import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import { ApiError } from '../middleware/error-handler.js';
import type {
  ApiResponse,
  Freezer,
  CreateFreezerInput,
  UpdateFreezerInput,
  StorageBox,
  CreateStorageBoxInput,
  UpdateStorageBoxInput,
  StorageBoxWithSamples,
  FreezerWithBoxes,
  BoxSample,
  BoxPosition,
  BoxGridView,
} from '@lab-data-manager/shared';

export const storageRouter = Router();

// === Freezers ===

// GET /api/storage/freezers
storageRouter.get('/freezers', (_req, res) => {
  const db = getDatabase();

  const freezers = db.prepare(`
    SELECT
      f.*,
      COUNT(DISTINCT sb.id) as box_count,
      COUNT(DISTINCT sa.id) as total_samples,
      COALESCE(SUM(sb.rows * sb.columns), 0) as total_capacity
    FROM freezers f
    LEFT JOIN storage_boxes sb ON sb.freezer_id = f.id
    LEFT JOIN samples sa ON sa.storage_box_id = sb.id
    GROUP BY f.id
    ORDER BY f.name
  `).all() as (Freezer & { box_count: number; total_samples: number; total_capacity: number })[];

  res.json({ success: true, data: freezers } satisfies ApiResponse<typeof freezers>);
});

// GET /api/storage/freezers/:id
storageRouter.get('/freezers/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const freezer = db.prepare('SELECT * FROM freezers WHERE id = ?').get(id) as Freezer | undefined;

  if (!freezer) {
    throw new ApiError(404, 'Freezer not found');
  }

  const boxes = db.prepare(
    'SELECT * FROM storage_boxes WHERE freezer_id = ? ORDER BY shelf, rack, name'
  ).all(id) as StorageBox[];

  const sampleCount = db.prepare(`
    SELECT COUNT(*) as count FROM samples
    WHERE storage_box_id IN (SELECT id FROM storage_boxes WHERE freezer_id = ?)
  `).get(id) as { count: number };

  const totalCapacity = db.prepare(`
    SELECT COALESCE(SUM(rows * columns), 0) as total FROM storage_boxes WHERE freezer_id = ?
  `).get(id) as { total: number };

  const result: FreezerWithBoxes = {
    ...freezer,
    boxes,
    total_samples: sampleCount.count,
    total_capacity: totalCapacity.total,
  };

  res.json({ success: true, data: result } satisfies ApiResponse<FreezerWithBoxes>);
});

// POST /api/storage/freezers
storageRouter.post('/freezers', (req, res) => {
  const db = getDatabase();
  const input: CreateFreezerInput = req.body;

  if (!input.name) {
    throw new ApiError(400, 'Name is required');
  }

  const result = db.prepare(`
    INSERT INTO freezers (name, location, temperature, description)
    VALUES (?, ?, ?, ?)
  `).run(
    input.name,
    input.location || null,
    input.temperature ?? null,
    input.description || null
  );

  const freezer = db.prepare('SELECT * FROM freezers WHERE id = ?').get(result.lastInsertRowid) as Freezer;

  res.status(201).json({ success: true, data: freezer } satisfies ApiResponse<Freezer>);
});

// PUT /api/storage/freezers/:id
storageRouter.put('/freezers/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: UpdateFreezerInput = req.body;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.location !== undefined) { fields.push('location = ?'); values.push(input.location); }
  if (input.temperature !== undefined) { fields.push('temperature = ?'); values.push(input.temperature); }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }

  if (fields.length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  values.push(id);
  db.prepare(`UPDATE freezers SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const freezer = db.prepare('SELECT * FROM freezers WHERE id = ?').get(id) as Freezer;
  res.json({ success: true, data: freezer } satisfies ApiResponse<Freezer>);
});

// DELETE /api/storage/freezers/:id
storageRouter.delete('/freezers/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const result = db.prepare('DELETE FROM freezers WHERE id = ?').run(id);

  if (result.changes === 0) {
    throw new ApiError(404, 'Freezer not found');
  }

  res.json({ success: true, message: 'Freezer deleted' } satisfies ApiResponse<never>);
});

// === Storage Boxes ===

// GET /api/storage/boxes?freezer_id=X
storageRouter.get('/boxes', (req, res) => {
  const db = getDatabase();
  const { freezer_id } = req.query;

  let query = `
    SELECT
      sb.*,
      f.name as freezer_name,
      f.location as freezer_location,
      COUNT(sa.id) as occupied_positions,
      sb.rows * sb.columns as total_positions
    FROM storage_boxes sb
    JOIN freezers f ON f.id = sb.freezer_id
    LEFT JOIN samples sa ON sa.storage_box_id = sb.id
  `;
  const params: unknown[] = [];

  if (freezer_id) {
    query += ' WHERE sb.freezer_id = ?';
    params.push(freezer_id);
  }

  query += ' GROUP BY sb.id ORDER BY f.name, sb.shelf, sb.rack, sb.name';

  const boxes = db.prepare(query).all(...params) as (StorageBox & {
    freezer_name: string;
    freezer_location: string | null;
    occupied_positions: number;
    total_positions: number;
  })[];

  res.json({ success: true, data: boxes } satisfies ApiResponse<typeof boxes>);
});

// GET /api/storage/boxes/:id
storageRouter.get('/boxes/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const box = db.prepare(`
    SELECT sb.*, f.name as freezer_name, f.location as freezer_location
    FROM storage_boxes sb
    JOIN freezers f ON f.id = sb.freezer_id
    WHERE sb.id = ?
  `).get(id) as (StorageBox & { freezer_name: string; freezer_location: string | null }) | undefined;

  if (!box) {
    throw new ApiError(404, 'Storage box not found');
  }

  const samples = db.prepare(`
    SELECT
      sa.id,
      sa.box_position as position,
      sa.sample_type,
      s.ear_tag,
      sa.collection_date,
      e.name as experiment_name
    FROM samples sa
    JOIN subjects s ON s.id = sa.subject_id
    JOIN experiments e ON e.id = s.experiment_id
    WHERE sa.storage_box_id = ?
    ORDER BY sa.box_position
  `).all(id) as BoxSample[];

  const result: StorageBoxWithSamples = {
    ...box,
    freezer_location: box.freezer_location ?? undefined,
    samples,
    occupied_positions: samples.length,
    total_positions: box.rows * box.columns,
  };

  res.json({ success: true, data: result } satisfies ApiResponse<StorageBoxWithSamples>);
});

// GET /api/storage/boxes/:id/grid - Get box as grid view
storageRouter.get('/boxes/:id/grid', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const box = db.prepare('SELECT * FROM storage_boxes WHERE id = ?').get(id) as StorageBox | undefined;

  if (!box) {
    throw new ApiError(404, 'Storage box not found');
  }

  const samples = db.prepare(`
    SELECT
      sa.id,
      sa.box_position as position,
      sa.sample_type,
      s.ear_tag,
      sa.collection_date,
      e.name as experiment_name
    FROM samples sa
    JOIN subjects s ON s.id = sa.subject_id
    JOIN experiments e ON e.id = s.experiment_id
    WHERE sa.storage_box_id = ?
  `).all(id) as BoxSample[];

  // Create sample lookup by position
  const sampleMap = new Map(samples.map(s => [s.position, s]));

  // Build grid
  const positions: BoxPosition[][] = [];
  for (let row = 0; row < box.rows; row++) {
    const rowPositions: BoxPosition[] = [];
    for (let col = 0; col < box.columns; col++) {
      const position = `${String.fromCharCode(65 + row)}${col + 1}`;
      const sample = sampleMap.get(position);
      rowPositions.push({
        position,
        row,
        column: col,
        occupied: !!sample,
        sample,
      });
    }
    positions.push(rowPositions);
  }

  const result: BoxGridView = {
    box,
    positions,
  };

  res.json({ success: true, data: result } satisfies ApiResponse<BoxGridView>);
});

// POST /api/storage/boxes
storageRouter.post('/boxes', (req, res) => {
  const db = getDatabase();
  const input: CreateStorageBoxInput = req.body;

  if (!input.freezer_id || !input.name || !input.box_type) {
    throw new ApiError(400, 'freezer_id, name, and box_type are required');
  }

  // Set default dimensions based on box type
  let rows = input.rows;
  let columns = input.columns;
  if (!rows || !columns) {
    switch (input.box_type) {
      case '81-well':
        rows = 9;
        columns = 9;
        break;
      case '100-well':
        rows = 10;
        columns = 10;
        break;
      case '25-well':
        rows = 5;
        columns = 5;
        break;
      default:
        rows = input.rows || 9;
        columns = input.columns || 9;
    }
  }

  const result = db.prepare(`
    INSERT INTO storage_boxes (freezer_id, name, box_type, rows, columns, shelf, rack, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.freezer_id,
    input.name,
    input.box_type,
    rows,
    columns,
    input.shelf || null,
    input.rack || null,
    input.notes || null
  );

  const box = db.prepare('SELECT * FROM storage_boxes WHERE id = ?').get(result.lastInsertRowid) as StorageBox;

  res.status(201).json({ success: true, data: box } satisfies ApiResponse<StorageBox>);
});

// PUT /api/storage/boxes/:id
storageRouter.put('/boxes/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const input: UpdateStorageBoxInput = req.body;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.freezer_id !== undefined) { fields.push('freezer_id = ?'); values.push(input.freezer_id); }
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.box_type !== undefined) { fields.push('box_type = ?'); values.push(input.box_type); }
  if (input.rows !== undefined) { fields.push('rows = ?'); values.push(input.rows); }
  if (input.columns !== undefined) { fields.push('columns = ?'); values.push(input.columns); }
  if (input.shelf !== undefined) { fields.push('shelf = ?'); values.push(input.shelf); }
  if (input.rack !== undefined) { fields.push('rack = ?'); values.push(input.rack); }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }

  if (fields.length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  values.push(id);
  db.prepare(`UPDATE storage_boxes SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const box = db.prepare('SELECT * FROM storage_boxes WHERE id = ?').get(id) as StorageBox;
  res.json({ success: true, data: box } satisfies ApiResponse<StorageBox>);
});

// DELETE /api/storage/boxes/:id
storageRouter.delete('/boxes/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  const result = db.prepare('DELETE FROM storage_boxes WHERE id = ?').run(id);

  if (result.changes === 0) {
    throw new ApiError(404, 'Storage box not found');
  }

  res.json({ success: true, message: 'Storage box deleted' } satisfies ApiResponse<never>);
});
