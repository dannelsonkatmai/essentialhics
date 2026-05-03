import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { logger } from './config/logger';

// Phase 1 routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import facilityRoutes from './routes/facilities.routes';
import auditLogRoutes from './routes/auditLog.routes';
import healthSystemRoutes from './routes/healthSystem.routes';

// Phase 2 routes
import incidentRoutes from './modules/incidents/incident.routes';
import iapRoutes from './modules/iap/iap.routes';
import templateRoutes from './modules/templates/template.routes';
import positionRoutes from './modules/positions/position.routes';
import notificationRoutes from './modules/notifications/notification.routes';

// Phase 3 routes
import { resourcesRouter, resourceCatalogRouter } from './modules/resources/resources.routes';
import { requestsRouter } from './modules/requests/requests.routes';
import { costsRouter } from './modules/costs/costs.routes';
import { mutualAidRouter } from './modules/mutualaid/mutualaid.routes';

import { errorHandler, notFound } from './middleware/errorHandler.middleware';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── General middleware ────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '2mb' })); // bumped to 2mb for signature data
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// HTTP request logging (skip health checks)
app.use(
  morgan('combined', {
    skip: (req) => req.path === '/health',
    stream: { write: (msg) => logger.http(msg.trim()) },
  }),
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Phase 1 API routes ────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/health-system', healthSystemRoutes);

// ── Phase 2 API routes ────────────────────────────────────────────────────────
// Incidents + Operational Periods (facility-scoped)
app.use('/api/facilities/:facilityId/incidents', incidentRoutes);

// IAP (includes form auto-save, workflow, comments, PDF export)
app.use('/api/iap', iapRoutes);

// ICS-213 general message log (incident-scoped convenience path)
app.use('/api/facilities/:facilityId', iapRoutes);

// Org board position assignments
app.use('/api/facilities/:facilityId/incidents/:incidentId/positions', positionRoutes);

// IAP Templates + Objectives/Tactics Bank (system/facility-scoped)
app.use('/api/templates', templateRoutes);

// In-app notifications
app.use('/api/notifications', notificationRoutes);

// ── Phase 3 API routes ────────────────────────────────────────────────────────

// Resource catalog (facility-level)
app.use('/api/facilities/:facilityId/resource-catalog', resourceCatalogRouter);

// Incident resources + status board
app.use('/api/facilities/:facilityId/incidents/:incidentId/resources', resourcesRouter);

// ICS-213RR resource requests
app.use('/api/facilities/:facilityId/incidents/:incidentId/requests', requestsRouter);

// Cost ledger + FEMA PA export
app.use('/api/facilities/:facilityId/incidents/:incidentId/costs', costsRouter);

// Mutual aid agreements
app.use('/api/facilities/:facilityId/mutual-aid', mutualAidRouter);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
