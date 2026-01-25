-- Lab Data Manager Database Schema

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Experiments table
CREATE TABLE IF NOT EXISTS experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    baseline_day_offset INTEGER NOT NULL DEFAULT 0,
    endpoint_weight_loss_pct REAL NOT NULL DEFAULT 15,
    endpoint_css_threshold INTEGER,
    endpoint_css_operator TEXT CHECK (endpoint_css_operator IN ('>=', '>', '=', '<', '<=')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Treatment groups table
CREATE TABLE IF NOT EXISTS treatment_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(experiment_id, name)
);

-- Protocol timepoints table
CREATE TABLE IF NOT EXISTS protocol_timepoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    day_offset INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sample_types TEXT, -- JSON array stored as text
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(experiment_id, day_offset)
);

-- Subjects (mice) table
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    treatment_group_id INTEGER NOT NULL REFERENCES treatment_groups(id) ON DELETE RESTRICT,
    ear_tag TEXT NOT NULL,
    cage_number TEXT NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('M', 'F')),
    diet TEXT,
    date_of_birth TEXT,
    baseline_weight REAL,
    status TEXT NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'dead', 'sacrificed', 'excluded')),
    exit_date TEXT,
    exit_type TEXT CHECK (exit_type IN ('natural_death', 'sacrificed_endpoint', 'sacrificed_scheduled', 'excluded', 'other')),
    exit_reason TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(experiment_id, ear_tag)
);

-- Observations table
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    observation_date TEXT NOT NULL,
    day_of_study INTEGER NOT NULL,
    weight REAL,
    weight_pct_change REAL,
    weight_score INTEGER,
    stool_score INTEGER CHECK (stool_score BETWEEN 0 AND 4),
    behavior_score INTEGER CHECK (behavior_score BETWEEN 0 AND 4),
    total_css INTEGER,
    notes TEXT,
    observer TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(subject_id, observation_date)
);

-- Samples table (longitudinal and endpoint)
CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    sample_type TEXT NOT NULL,
    collection_date TEXT NOT NULL,
    day_of_study INTEGER NOT NULL,
    timepoint_id INTEGER REFERENCES protocol_timepoints(id) ON DELETE SET NULL,
    storage_box_id INTEGER REFERENCES storage_boxes(id) ON DELETE SET NULL,
    box_position TEXT,
    volume_ul REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Freezers table
CREATE TABLE IF NOT EXISTS freezers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    location TEXT,
    temperature REAL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Storage boxes table
CREATE TABLE IF NOT EXISTS storage_boxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    freezer_id INTEGER NOT NULL REFERENCES freezers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    box_type TEXT NOT NULL CHECK (box_type IN ('81-well', '100-well', '25-well', 'custom')),
    rows INTEGER NOT NULL DEFAULT 9,
    columns INTEGER NOT NULL DEFAULT 9,
    shelf TEXT,
    rack TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(freezer_id, name)
);

-- Assay results table
CREATE TABLE IF NOT EXISTS assay_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    assay_name TEXT NOT NULL,
    result_value REAL,
    result_unit TEXT,
    result_text TEXT,
    run_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_subjects_experiment ON subjects(experiment_id);
CREATE INDEX IF NOT EXISTS idx_subjects_treatment_group ON subjects(treatment_group_id);
CREATE INDEX IF NOT EXISTS idx_subjects_cage ON subjects(experiment_id, cage_number);
CREATE INDEX IF NOT EXISTS idx_subjects_status ON subjects(status);

CREATE INDEX IF NOT EXISTS idx_observations_subject ON observations(subject_id);
CREATE INDEX IF NOT EXISTS idx_observations_date ON observations(observation_date);
CREATE INDEX IF NOT EXISTS idx_observations_subject_date ON observations(subject_id, observation_date);

CREATE INDEX IF NOT EXISTS idx_samples_subject ON samples(subject_id);
CREATE INDEX IF NOT EXISTS idx_samples_collection_date ON samples(collection_date);
CREATE INDEX IF NOT EXISTS idx_samples_storage ON samples(storage_box_id);

CREATE INDEX IF NOT EXISTS idx_treatment_groups_experiment ON treatment_groups(experiment_id);
CREATE INDEX IF NOT EXISTS idx_protocol_timepoints_experiment ON protocol_timepoints(experiment_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_experiments_timestamp
    AFTER UPDATE ON experiments
    BEGIN
        UPDATE experiments SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_subjects_timestamp
    AFTER UPDATE ON subjects
    BEGIN
        UPDATE subjects SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_observations_timestamp
    AFTER UPDATE ON observations
    BEGIN
        UPDATE observations SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_samples_timestamp
    AFTER UPDATE ON samples
    BEGIN
        UPDATE samples SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_freezers_timestamp
    AFTER UPDATE ON freezers
    BEGIN
        UPDATE freezers SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_storage_boxes_timestamp
    AFTER UPDATE ON storage_boxes
    BEGIN
        UPDATE storage_boxes SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_assay_results_timestamp
    AFTER UPDATE ON assay_results
    BEGIN
        UPDATE assay_results SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
