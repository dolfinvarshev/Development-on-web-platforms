// [B4] Simulator config — the single SimConfig document driving the incident engine.
// Contract: docs/ARCHITECTURE.md §6 (Simulator config).
import { Router } from 'express';
import { getSimConfig } from '../db/mongo.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

// Express 4 does not forward rejected promises from async handlers to the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function serializeConfig(cfg) {
  return {
    config: {
      radiusM: cfg.radiusM,
      scatterFactor: cfg.scatterFactor,
      freshTelemetryMinutes: cfg.freshTelemetryMinutes,
      defaultCenter: { lat: cfg.defaultCenter.lat, lng: cfg.defaultCenter.lng },
    },
  };
}

const isFiniteIn = (v, min, max) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// GET /api/config — public: the simulator UI reads radius/center defaults from here.
router.get(
  '/',
  wrap(async (req, res) => {
    res.json(serializeConfig(await getSimConfig()));
  })
);

// PUT /api/config — admin partial update. Every provided field is validated before any
// assignment so an invalid request never leaves the document half-updated.
router.put(
  '/',
  requireAdmin,
  wrap(async (req, res) => {
    const body = req.body ?? {};
    const invalid = () => res.status(400).json({ error: 'validation', message: 'ערך לא תקין' });

    const updates = {};
    if (body.radiusM !== undefined) {
      if (!isFiniteIn(body.radiusM, 100, 20000)) return invalid();
      updates.radiusM = body.radiusM;
    }
    if (body.scatterFactor !== undefined) {
      if (!isFiniteIn(body.scatterFactor, 1, 10)) return invalid();
      updates.scatterFactor = body.scatterFactor;
    }
    if (body.freshTelemetryMinutes !== undefined) {
      if (!isFiniteIn(body.freshTelemetryMinutes, 1, 120)) return invalid();
      updates.freshTelemetryMinutes = body.freshTelemetryMinutes;
    }
    if (body.defaultCenter !== undefined) {
      const c = body.defaultCenter;
      if (
        !c ||
        typeof c !== 'object' ||
        !isFiniteIn(c.lat, -90, 90) ||
        !isFiniteIn(c.lng, -180, 180)
      ) {
        return invalid();
      }
      updates.defaultCenter = { lat: c.lat, lng: c.lng };
    }

    const cfg = await getSimConfig();
    Object.assign(cfg, updates);
    await cfg.save();
    res.json(serializeConfig(cfg));
  })
);

export default router;
