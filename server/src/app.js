import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import registryRoutes from './routes/registry.js';
import incidentRoutes from './routes/incidents.js';
import telemetryRoutes from './routes/telemetry.js';
import contentRoutes from './routes/content.js';
import configRoutes from './routes/config.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, service: 'definet-api', time: new Date().toISOString() })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api', registryRoutes);
  app.use('/api/incidents', incidentRoutes);
  app.use('/api', telemetryRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/config', configRoutes);

  app.use((req, res) => res.status(404).json({ error: 'not_found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[api] error:', err);
    const body = { error: 'server_error' };
    // Echo the internal message only outside production, so 500s never leak
    // stack / DB-driver / connection details to unauthenticated callers.
    if (process.env.NODE_ENV !== 'production') body.message = err.message;
    res.status(500).json(body);
  });

  return app;
}
