import { createApp } from './app.js';
import { initializeDatabase, closeDatabase } from './db/connection.js';
import { startBackupScheduler, stopBackupScheduler } from './services/backup.js';
import { runStartupIntegrityCheck, startIntegrityScheduler, stopIntegrityScheduler } from './services/integrity.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function startServer() {
  // Initialize database
  initializeDatabase();

  // Run startup integrity check
  runStartupIntegrityCheck();

  // Start backup scheduler
  startBackupScheduler();

  // Start integrity check scheduler (runs 30 min after backup by default)
  startIntegrityScheduler();

  // Create Express app
  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`HTTP server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });

  // Graceful shutdown
  function shutdown() {
    console.log('\nShutting down...');
    stopBackupScheduler();
    stopIntegrityScheduler();

    server.close(() => {
      closeDatabase();
      console.log('Server closed');
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the server
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
