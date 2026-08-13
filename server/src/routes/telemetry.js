// [B4] Fleet & telemetry — GET /devices, device telemetry "tweets", silent tick, alert log.
// Contract: docs/ARCHITECTURE.md §6 (Fleet & telemetry).
import { Router } from 'express';
import { getDb } from '../db/sqlite.js';
import { AlertLog, TelemetryLog } from '../db/mongo.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { maskPhone } from '../lib/phone.js';
import {
  crossedLowBattery,
  batteryAlertMessage,
  serializeAlert,
  runSilentUpdateCycle,
} from '../lib/silent-update.js';

const router = Router();

// Express 4 does not forward rejected promises from async handlers to the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const CHANNELS = ['lora', 'magnus', 'phone'];

const DEVICE_SELECT = `
  SELECT d.id, d.label, d.kind, d.has_defib, d.has_lora, d.has_magnus, d.battery,
         d.status, d.lat, d.lng, d.location_source, d.last_seen,
         u.first_name, u.last_name, u.phone, u.category
  FROM devices d
  JOIN users u ON u.id = d.user_id
`;

function mapDevice(row) {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    hasDefib: !!row.has_defib,
    hasLora: !!row.has_lora,
    hasMagnus: !!row.has_magnus,
    battery: row.battery,
    status: row.status,
    lat: row.lat,
    lng: row.lng,
    locationSource: row.location_source,
    lastSeen: row.last_seen,
    owner: {
      firstName: row.first_name,
      lastName: row.last_name,
      // GET /api/devices is public — never leak a registrant's full number here.
      phone: maskPhone(row.phone),
      category: row.category,
    },
  };
}

const isFiniteIn = (v, min, max) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// GET /api/devices — the full fleet with owner details (public: feeds the simulator map).
router.get('/devices', (req, res) => {
  const rows = getDb().prepare(`${DEVICE_SELECT} ORDER BY d.id`).all();
  res.json({ devices: rows.map(mapDevice) });
});

// POST /api/devices/:id/telemetry — a single simulated device-originated LoRa "tweet".
router.post(
  '/devices/:id/telemetry',
  wrap(async (req, res) => {
    const db = getDb();
    const id = Number(req.params.id);
    const row = Number.isInteger(id)
      ? db.prepare(`${DEVICE_SELECT} WHERE d.id = ?`).get(id)
      : undefined;
    if (!row) return res.status(404).json({ error: 'not_found' });

    const body = req.body ?? {};
    const { battery, lat, lng } = body;
    if (battery !== undefined && !isFiniteIn(battery, 0, 100)) {
      return res.status(400).json({ error: 'validation', message: 'ערך לא תקין' });
    }
    if (lat !== undefined && !isFiniteIn(lat, -90, 90)) {
      return res.status(400).json({ error: 'validation', message: 'ערך לא תקין' });
    }
    if (lng !== undefined && !isFiniteIn(lng, -180, 180)) {
      return res.status(400).json({ error: 'validation', message: 'ערך לא תקין' });
    }
    if (body.channel !== undefined && !CHANNELS.includes(body.channel)) {
      return res.status(400).json({ error: 'validation', message: 'ערך לא תקין' });
    }
    const channel = body.channel ?? row.location_source;

    const nowIso = new Date().toISOString();
    const next = {
      battery: battery !== undefined ? Math.round(battery) : row.battery,
      lat: lat !== undefined ? lat : row.lat,
      lng: lng !== undefined ? lng : row.lng,
    };
    db.prepare(
      `UPDATE devices SET battery = ?, lat = ?, lng = ?, location_source = ?, last_seen = ? WHERE id = ?`
    ).run(next.battery, next.lat, next.lng, channel, nowIso, id);

    await TelemetryLog.create({
      deviceId: id,
      channel: channel ?? undefined,
      battery: next.battery,
      lat: next.lat,
      lng: next.lng,
    });

    let alertDoc = null;
    if (crossedLowBattery(row.battery, next.battery)) {
      alertDoc = await AlertLog.create({
        type: 'maintenance_battery',
        deviceId: id,
        deviceLabel: row.label,
        message: batteryAlertMessage(row.label, next.battery),
      });
    }

    const updated = db.prepare(`${DEVICE_SELECT} WHERE d.id = ?`).get(id);
    res.json({ device: mapDevice(updated), alert: alertDoc ? serializeAlert(alertDoc) : null });
  })
);

// POST /api/telemetry/tick — one on-demand "silent update" cycle (the demo button).
// The same cycle also runs autonomously on a server-side interval (see index.js),
// which is what the spec's "without human intervention" clause describes.
router.post(
  '/telemetry/tick',
  wrap(async (req, res) => {
    res.json(await runSilentUpdateCycle());
  })
);

// GET /api/alerts?limit=50 — admin: the alert log, newest first.
router.get(
  '/alerts',
  requireAdmin,
  wrap(async (req, res) => {
    const requested = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 200) : 50;
    const docs = await AlertLog.find().sort({ createdAt: -1 }).limit(limit);
    res.json({ alerts: docs.map(serializeAlert) });
  })
);

export default router;
