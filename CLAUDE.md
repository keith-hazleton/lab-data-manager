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

5. **PWA Offline Support**
   - Progressive Web App installable on iOS Safari
   - "Sync for Offline" button on experiment dashboard downloads data to IndexedDB
   - Offline data entry for observations, batch entry, death/sacrifice, sample collection
   - Mutations queued in IndexedDB when offline, pushed on reconnect
   - Manual "Sync Now" button (no Background Sync — iOS doesn't support it)
   - Conflict detection: if same observation exists, keeps latest by timestamp
   - Offline indicator bar shows pending count and sync status

### Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, TanStack Query, Recharts
- **PWA**: vite-plugin-pwa (Workbox), idb (IndexedDB)
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite (better-sqlite3) at `data/lab-data.db`
- **Monorepo**: npm workspaces (shared, server, client)

### Key Files

- `shared/src/types/` - All TypeScript interfaces
- `server/src/routes/` - API endpoints
- `server/src/db/schema.sql` - Database schema
- `client/src/pages/` - Main page components
- `client/src/hooks/useApi.ts` - Data fetching hooks (with offline mutation queueing)
- `client/src/hooks/useOfflineData.ts` - Offline-aware data hooks (fallback to IndexedDB)
- `client/src/db/offline-db.ts` - IndexedDB storage layer
- `client/src/services/sync-manager.ts` - Sync push/download logic
- `client/src/context/AppContext.tsx` - Online/offline state, pending count, sync actions
- `server/src/routes/sync.ts` - Bulk sync API endpoints

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

### PWA Offline Support (Implemented)

Progressive Web App with offline data entry for iOS Safari. Users sync experiment data before going to the basement, enter observations offline, then sync back when online.

**How it works:**
1. On experiment dashboard, click "Sync for Offline" to download all data to IndexedDB
2. Go offline (basement, airplane mode, etc.)
3. Enter observations, batch entries, death/sacrifices, or samples as normal
4. Mutations are queued in IndexedDB (shown in bottom bar as "X pending")
5. When back online, click "Sync Now" to push changes to server
6. Server processes each mutation, detects conflicts (same subject+date), keeps latest
7. After push, fresh data is re-downloaded to update server-calculated fields

**Architecture:**
- `vite-plugin-pwa` + Workbox for service worker and app manifest
- `idb` library for IndexedDB (replaces old localStorage queue)
- Manual sync only (no Background Sync API — iOS doesn't support it)
- Service worker caches app shell only; API data lives in IndexedDB

**API endpoints:**
- `GET /api/sync/experiment/:id` — returns experiment + treatment groups + subjects + observations (last 30 days) + samples
- `POST /api/sync/push` — receives array of queued mutations, processes in order, returns per-item success/failure/conflict

**Key files:**
- `server/src/routes/sync.ts` — Sync API endpoints
- `client/src/db/offline-db.ts` — IndexedDB storage layer (stores: experiments, treatmentGroups, subjects, observations, samples, syncQueue, syncMeta)
- `client/src/services/sync-manager.ts` — Push/download logic
- `client/src/hooks/useOfflineData.ts` — Offline-aware query hooks
- `client/src/hooks/useApi.ts` — Mutation hooks queue to IndexedDB when offline
- `client/src/context/AppContext.tsx` — Online state, pendingCount, syncNow()
- `client/src/components/OfflineIndicator.tsx` — Bottom bar with status + sync button
- `client/src/components/SyncForOffline.tsx` — Download button on experiment dashboard

**iOS considerations:**
- `registerType: 'prompt'` avoids silent updates that confuse iOS Safari
- IndexedDB for all data (not Cache API) — more reliable on iOS long-term
- `apple-mobile-web-app-capable` meta tag in index.html

**Offline-capable pages:**
- MouseEntry (individual observation entry)
- BatchEntry (batch "all normal" observations)
- DeathSacrifice (record exits)
- SampleCollection (batch sample creation)

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

### Automatic Backups (Implemented)

The backup system supports scheduled database backups to multiple destinations:

**Features:**
- Daily scheduled backups (default: 2am)
- GPG encryption before storage (recommended for sensitive data)
- Local USB drive storage
- Cloud sync via rclone (OneDrive, Google Drive, etc.)
- SHA256 checksum verification
- 30-day retention policy (configurable)
- API endpoints for status, history, and manual triggers

**Configuration (environment variables):**
```bash
BACKUP_ENABLED=true                      # Enable scheduled backups
BACKUP_DIR=/mnt/usb/lab-backups          # Local backup path
BACKUP_SCHEDULE="0 2 * * *"              # Cron schedule (daily at 2am)
BACKUP_RETENTION_DAYS=30                 # Days to keep backups
BACKUP_GPG_RECIPIENT=your@email.com      # GPG key for encryption (recommended)
BACKUP_RCLONE_REMOTE=onedrive:lab-backups # Cloud destination (optional)
```

**Encryption:** When `BACKUP_GPG_RECIPIENT` is set, backups are encrypted with GPG
before being saved locally or synced to cloud. To restore: `gpg --decrypt backup.db.gpg > restored.db`

**API endpoints:**
- `GET /api/backup/status` - Current config and last backup info
- `GET /api/backup/history` - List of recent backups with checksums
- `POST /api/backup/trigger` - Manually trigger a backup

**Files:**
- `server/src/services/backup.ts` - Backup service with scheduler
- `server/src/routes/backup.ts` - API endpoints
- `data/backup-history.json` - Backup history records

See `scripts/setup-pi.sh` for USB drive and rclone setup instructions

### Database Integrity Checks (Implemented)

Automatic database integrity verification using SQLite PRAGMA commands.

**Features:**
- Startup integrity check on server start
- Daily scheduled checks (default: 2:30am, 30 min after backup)
- Runs `PRAGMA integrity_check`, `quick_check`, and `foreign_key_check`
- Results included in backup status API

**Configuration:**
```bash
INTEGRITY_CHECK_SCHEDULE="30 2 * * *"  # Cron schedule (default: 2:30am)
```

**API endpoints:**
- `GET /api/backup/status` - Includes `integrity` object with last check result
- `GET /api/backup/integrity` - History of integrity check results
- `POST /api/backup/integrity/check` - Manually trigger an integrity check

**Files:**
- `server/src/services/integrity.ts` - Integrity check service
- `data/integrity-history.json` - Check history records

### Comprehensive Data Export (Implemented)

Export all data tables as CSV files via API or web interface.

**Web interface:**
- "Export All" button on experiments list page downloads ZIP with all data
- Download icon on each experiment card exports that experiment's observations and samples

**API endpoints:**
- `GET /api/export/all` - ZIP file containing all tables as CSVs
- `GET /api/export/experiments` - All experiments
- `GET /api/export/treatment-groups` - All treatment groups
- `GET /api/export/subjects` - All subjects
- `GET /api/export/observations/all` - All observations (cross-experiment)
- `GET /api/export/samples/all` - All samples (cross-experiment)
- `GET /api/export/freezers` - All freezers
- `GET /api/export/storage-boxes` - All storage boxes

**ZIP export contents:**
- `experiments.csv`
- `treatment_groups.csv`
- `subjects.csv`
- `observations.csv`
- `samples.csv`
- `freezers.csv`
- `storage_boxes.csv`
- `metadata.json` (export timestamp, version, row counts)

**Format options:** Add `?format=json` to any endpoint for JSON output (default: CSV)

## Notes

- Exit types for subjects: `natural_death`, `sacrificed_endpoint`, `sacrificed_scheduled`, `excluded`, `other`
- Only `natural_death` counts as an event in Kaplan-Meier; others are censored
- Treatment groups matched across experiments by name (case-sensitive)
- CSS thresholds: Warning at 4, Critical at 7
