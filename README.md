# Lab Data Manager

A web application for managing laboratory mouse experiment data, including subject tracking, sample management, storage organization, and data visualization.

## Features

### Experiments Module
- Create and manage experiments with treatment groups
- Track individual subjects (mice) with ear tags, sex, and treatment assignments
- Record daily observations (weight, clinical score)
- Track subject outcomes (deaths, sacrifices, exclusions)

### All Samples Browser
- View samples across all experiments in one place
- Filter by experiment, sample type, and storage status
- Batch assign samples to storage locations

### Sample Storage
- Organize freezers, racks, and boxes
- Visual box layout with position tracking
- Drag-and-drop sample assignment
- Track sample locations and retrieval

### Plots & Visualization
- **Survival Curves**: Kaplan-Meier step functions with proper censoring
- **Weight Over Time**: Median by treatment group or individual mouse traces
- **CSS Score Over Time**: Clinical score tracking with warning/critical thresholds
- Cross-experiment comparison by treatment group name
- Interactive filtering and mouse highlighting

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, TanStack Query, Recharts
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite (better-sqlite3)
- **Monorepo**: npm workspaces

## Project Structure

```
lab-data-manager/
├── client/          # React frontend
├── server/          # Express API server
├── shared/          # Shared TypeScript types
├── scripts/         # Data import scripts
└── data/            # SQLite database
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Install dependencies for all packages
npm install

# Build shared types
npm run build -w shared
```

### Development

```bash
# Start both server and client in development mode
npm run dev

# Or run separately:
npm run dev -w server   # API server on port 3001
npm run dev -w client   # Vite dev server on port 5173
```

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Experiments
- `GET /api/experiments` - List all experiments
- `POST /api/experiments` - Create experiment
- `GET /api/experiments/:id` - Get experiment details
- `GET /api/experiments/:id/subjects` - List subjects
- `GET /api/experiments/:id/observations` - List observations

### Samples
- `GET /api/samples/global` - List samples across experiments
- `POST /api/samples/batch-assign` - Batch assign to storage
- `GET /api/experiments/:id/samples` - List experiment samples

### Storage
- `GET /api/storage/locations` - List freezers/racks/boxes
- `POST /api/storage/freezers` - Create freezer
- `GET /api/storage/boxes/:id` - Get box with samples

### Plots
- `GET /api/plots/survival` - Kaplan-Meier survival data
- `GET /api/plots/weight` - Weight timeseries data
- `GET /api/plots/css` - CSS score timeseries data
- `GET /api/plots/treatment-groups` - Unified treatment groups

## Data Import

Import experiment data from CSV files using the import scripts:

```bash
npx tsx scripts/import-cdd07.ts
```

## Future Directions

### ELISA/qPCR Module
- Support for 96 and 384 well plate layouts
- Link plate wells to samples and subjects
- Standard curve fitting and concentration calculations
- Plate visualization and heatmaps

### Automatic Backups
- Scheduled database backups
- Local drive backup destination
- Cloud storage integration (Google Drive, Dropbox, etc.)
- Backup verification and restore functionality

## Contributing

This is a personal project shared publicly in case others find it useful. I make no guarantees about functionality or ongoing maintenance. Feedback is welcome, but I can't promise timely responses. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT
