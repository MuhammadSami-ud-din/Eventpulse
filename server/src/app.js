import express from 'express';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';

// Built by a factory (not at import time) so tests can create a fresh app with supertest.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
