# Lab Data Manager - Project Context

## Overview

Web application for managing mouse experiment data. Self-hosted on local network, designed for lab use with tablet-friendly interfaces.

## Current State (v1 - January 2025)

### Implemented Modules

1. **Experiments** (`/experiments/:id`)
   - Create experiments with treatment groups and subjects
   - Track subjects by ear tag, sex, cage assignment
   - Record deaths/sacrifices with exit types and dates
   - Daily observation entry (weight, CSS scores)

2. **Global Samples Browser** (`/samples`)
   - View samples across all experiments
   - Filter by experiment, sample type, storage status
   - Batch assign samples to storage locations

3. **Sample Storage** (`/storage`)
   - Freezer → Rack → Box hierarchy
   - Visual 9x9 box layouts with position tracking
   - Drag-and-drop sample assignment

4. **Plots** (`/plots`)
   - Kaplan-Meier survival curves (step functions with censoring)
   - Weight over time (median by treatment group or individual traces)
   - CSS score over time (with warning/critical threshold lines)
   - Cross-experiment comparison by treatment group name
   - Clickable legend to show/hide treatment groups

### Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, TanStack Query, Recharts
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite (better-sqlite3) at `data/lab-data.db`
- **Monorepo**: npm workspaces (shared, server, client)

### Key Files

- `shared/src/types/` - All TypeScript interfaces
- `server/src/routes/` - API endpoints
- `server/src/db/schema.sql` - Database schema
- `client/src/pages/` - Main page components
- `client/src/hooks/useApi.ts` - Data fetching hooks

### Running Locally (Development)

```bash
npm install
npm run build -w shared
npm run dev  # Starts both server (3001) and client (5173)
```

### Production Deployment (Raspberry Pi)

The production setup uses PM2 for process management with automatic crash recovery.

**Quick setup:**
```bash
chmod +x scripts/setup-pi.sh
./scripts/setup-pi.sh
```

**What this does:**
- Builds all packages (shared, server, client)
- Installs and configures PM2
- Sets up auto-start on Pi reboot
- Adds health check cron job (every 5 minutes)

**Key files:**
- `ecosystem.config.cjs` - PM2 configuration
- `scripts/setup-pi.sh` - Automated setup script
- `logs/` - PM2 log files (error.log, out.log)

**Useful commands:**
```bash
pm2 status              # Check if server is running
pm2 logs                # View server logs
pm2 restart all         # Restart server
pm2 monit               # Live monitoring dashboard
```

**Reliability features:**
- Auto-restart on crash (max 10 restarts)
- Memory limit restart at 200MB (safe for Pi)
- Health check at `/api/health` every 5 minutes
- Automatic startup on Pi reboot
- SQLite WAL mode protects against power loss

**Accessing from other devices:**
- Find Pi's IP: `hostname -I`
- Access at: `http://<pi-ip>:3001`

## Test Data

CDD07 experiment imported from `CDD07_metadata - Oct 2025.csv`:
- 4 treatment groups, 20 subjects
- Weight and CSS observations
- Blood and serum samples
- 2 death events for survival curve testing

## Future Directions

### ELISA/qPCR Module (Priority)

Add support for plate-based assay data:

- **Plate layouts**: 96-well and 384-well formats
- **Well assignment**: Link wells to samples and subjects
- **Standard curves**: Fit standards, calculate concentrations
- **Plate visualization**: Heatmaps, well annotations
- **Data import**: Support common plate reader export formats

Design considerations:
- Plates should link to samples (which link to subjects/experiments)
- Need to handle replicates and calculate CV
- Consider storing raw OD values vs calculated concentrations

### Automatic Backups

Scheduled database backups to multiple destinations:

- **Local drive**: External drive or NAS
- **Cloud storage**: Google Drive, Dropbox, or S3
- **Schedule**: Daily or on-change backups
- **Verification**: Checksum validation, restore testing
- **Retention**: Configurable backup history

Implementation options:
- Cron job or node-cron for scheduling
- Simple file copy for SQLite (with WAL checkpoint first)
- Could add a backup status indicator to the UI

## Notes

- Exit types for subjects: `natural_death`, `sacrificed_endpoint`, `sacrificed_scheduled`, `excluded`, `other`
- Only `natural_death` counts as an event in Kaplan-Meier; others are censored
- Treatment groups matched across experiments by name (case-sensitive)
- CSS thresholds: Warning at 4, Critical at 7
