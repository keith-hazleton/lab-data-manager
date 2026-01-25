import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { experimentsRouter } from './routes/experiments.js';
import { subjectsRouter } from './routes/subjects.js';
import { observationsRouter } from './routes/observations.js';
import { samplesRouter } from './routes/samples.js';
import { storageRouter } from './routes/storage.js';
import { exportRouter } from './routes/export.js';
import { plotsRouter } from './routes/plots.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for development
  }));
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/experiments', experimentsRouter);
  app.use('/api/subjects', subjectsRouter);
  app.use('/api/observations', observationsRouter);
  app.use('/api/samples', samplesRouter);
  app.use('/api/storage', storageRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/plots', plotsRouter);

  // In production, serve the built client
  if (isProduction) {
    const clientDist = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDist));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Error handling (only for API routes in production)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
