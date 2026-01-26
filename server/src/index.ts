import https from 'https';
import http from 'http';
import { createApp } from './app.js';
import { initializeDatabase, closeDatabase } from './db/connection.js';
import { startBackupScheduler, stopBackupScheduler } from './services/backup.js';
import { runStartupIntegrityCheck, startIntegrityScheduler, stopIntegrityScheduler } from './services/integrity.js';
import { ensureCertificates, loadCertificates, isHttpsEnabled } from './services/certificates.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000', 10);

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

  let server: http.Server | https.Server;
  let httpRedirectServer: http.Server | null = null;

  // Check if HTTPS should be enabled
  if (isHttpsEnabled()) {
    try {
      // Ensure certificates exist (generate if needed)
      await ensureCertificates();

      // Load certificates
      const certs = loadCertificates();

      // Create HTTPS server
      server = https.createServer(certs, app);

      server.listen(PORT, () => {
        console.log(`HTTPS server running on https://localhost:${PORT}`);
        console.log(`API available at https://localhost:${PORT}/api`);
        console.log('');
        console.log('Note: Self-signed certificate will show browser warning.');
        console.log('Accept the warning to proceed, or add certificate to trusted store.');
      });

      // Optionally create HTTP redirect server
      if (process.env.HTTP_REDIRECT === 'true') {
        const redirectApp = (req: http.IncomingMessage, res: http.ServerResponse) => {
          const host = req.headers.host?.replace(/:\d+$/, '') || 'localhost';
          res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
          res.end();
        };
        httpRedirectServer = http.createServer(redirectApp);
        httpRedirectServer.listen(HTTP_PORT, () => {
          console.log(`HTTP redirect server running on http://localhost:${HTTP_PORT} -> https://localhost:${PORT}`);
        });
      }
    } catch (err) {
      console.error('Failed to start HTTPS server:', err);
      console.log('Falling back to HTTP...');
      server = app.listen(PORT, () => {
        console.log(`HTTP server running on http://localhost:${PORT} (HTTPS unavailable)`);
        console.log(`API available at http://localhost:${PORT}/api`);
      });
    }
  } else {
    // HTTP mode (development)
    server = app.listen(PORT, () => {
      console.log(`HTTP server running on http://localhost:${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });
  }

  // Graceful shutdown
  function shutdown() {
    console.log('\nShutting down...');
    stopBackupScheduler();
    stopIntegrityScheduler();

    if (httpRedirectServer) {
      httpRedirectServer.close();
    }

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
