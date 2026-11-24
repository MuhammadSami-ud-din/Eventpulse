import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { noStore } from './middleware/cacheControl.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requireJsonBody } from './middleware/requireJsonBody.js';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { categoryRouter } from './routes/category.routes.js';
import { eventRouter } from './routes/event.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { meRouter } from './routes/me.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { organizerRouter } from './routes/organizer.routes.js';
import { ticketRouter } from './routes/ticket.routes.js';

// Helmet's default policy plus blob: images, which the ticket page uses to
// show the QR code it downloads through the API.
const contentSecurityPolicy = {
  directives: { imgSrc: ["'self'", 'data:', 'blob:'] },
};

// Vite puts content-hashed files in /assets: a new build means new file names,
// so they can be cached forever. Everything else must be revalidated so a
// deploy reaches users on their next visit.
function setStaticCacheHeaders(res, filePath) {
  const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`);
  res.set('Cache-Control', isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache');
}

// Single-page app: the browser router owns every non-API path (/events/3,
// /t/ABC...), so any GET that is not a file gets index.html.
function serveClient(app, clientDistDir) {
  const indexFile = path.join(clientDistDir, 'index.html');
  app.use(express.static(clientDistDir, { index: false, setHeaders: setStaticCacheHeaders }));
  app.use((req, res, next) => {
    // A missing file (e.g. an old /assets/x.js after a deploy) must be a real
    // 404, not index.html, which the browser would try to run as JavaScript.
    if ((req.method !== 'GET' && req.method !== 'HEAD') || path.extname(req.path)) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
}

// Built by a factory (not at import time) so tests can create a fresh app.
// `clientDistDir` is the built client to serve (production); omit it in
// development, where Vite serves the client itself.
export function createApp({ clientDistDir } = {}) {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet({ contentSecurityPolicy }));
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', requireJsonBody);
  app.use(cookieParser());
  app.use(csrfProtection);

  app.use('/api', noStore);
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/events', eventRouter);
  app.use('/api/me', meRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/organizer', organizerRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/tickets', ticketRouter);
  // Unknown API paths get a JSON 404, never the app's HTML page.
  app.use('/api', notFound);

  if (clientDistDir) serveClient(app, clientDistDir);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
