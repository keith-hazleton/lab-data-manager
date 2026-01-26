import { createApp } from './app.js';
import { initializeDatabase, closeDatabase } from './db/connection.js';
import { startBackupScheduler, stopBackupScheduler } from './services/backup.js';

const PORT = process.env.PORT || 3001;

// Initialize database
initializeDatabase();

// Start backup scheduler
startBackupScheduler();

// Create and start server
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down...');
  stopBackupScheduler();
  server.close(() => {
    closeDatabase();
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
