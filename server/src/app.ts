import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { experimentsRouter } from './routes/experiments.js';
import { subjectsRouter } from './routes/subjects.js';
import { observationsRouter } from './routes/observations.js';
import { samplesRouter } from './routes/samples.js';
import { storageRouter } from './routes/storage.js';
import { exportRouter } from './routes/export.js';
import { plotsRouter } from './routes/plots.js';

export function createApp() {
  const app = express();

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

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
