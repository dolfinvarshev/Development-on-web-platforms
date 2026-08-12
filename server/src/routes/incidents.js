// [B3] Incident engine — device scatter, geo-fencing, candidate ranking, hybrid alerts.
// Contract: docs/ARCHITECTURE.md §6 (Incidents).
import { Router } from 'express';
import mongoose from 'mongoose';
import { getDb } from '../db/sqlite.js';
import { Incident, AlertLog, getSimConfig } from '../db/mongo.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { haversineM, scatterAround } from '../lib/geo.js';

const router = Router();

// Express 4 does not forward rejected promises to the error middleware on its own.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const MAX_BREADCRUMBS = 500;
const STALE_WINDOW_MINUTES = 120;

function serializeIncident(doc) {
  const o = doc.toObject({ versionKey: false });
  o.id = String(o._id);
  delete o._id;
  return o;
}

// Shared guard for all /:id routes. Sends the 404 itself and returns null,
// so callers can simply bail out.
async function findIncidentOr404(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: 'not_found' });
    return null;
  }
  const incident = await Incident.findById(id);
  if (!incident) {
    res.status(404).json({ error: 'not_found' });
    return null;
  }
  return incident;
}

// POST /api/incidents — a distress call (simulator / citizen app). Public.
router.post(
  '/',
  wrap(async (req, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (
      !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lng) || lng < -180 || lng > 180
    ) {
      return res.status(400).json({ error: 'validation', message: 'נקודת אירוע לא תקינה' });
    }

    const cfg = await getSimConfig();
    const radiusM = Number(req.body?.radiusM) > 0 ? Number(req.body.radiusM) : cfg.radiusM;

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT d.id, d.label, d.kind, d.has_defib, d.has_lora, d.has_magnus,
                d.battery, d.location_source, u.phone, u.category
         FROM devices d
         JOIN users u ON u.id = d.user_id
         WHERE d.status = 'ok'`
      )
      .all();

    // Requirement 9: each distress call re-samples the fleet — every healthy device
    // gets a fresh random position inside radiusM * scatterFactor and a randomized
    // telemetry age (~50% "fresh" within freshTelemetryMinutes, rest up to 2 hours).
    const now = Date.now();
    const scattered = rows.map((row) => {
      const pos = scatterAround(lat, lng, radiusM * cfg.scatterFactor);
      const ageMinutes =
        Math.random() < 0.5
          ? Math.random() * cfg.freshTelemetryMinutes
          : Math.random() * STALE_WINDOW_MINUTES;
      const distanceM = haversineM(lat, lng, pos.lat, pos.lng);
      return {
        row,
        pos,
        lastSeen: new Date(now - ageMinutes * 60 * 1000),
        fresh: ageMinutes <= cfg.freshTelemetryMinutes,
        distanceM,
        inRadius: distanceM <= radiusM,
      };
    });

    const updateDevice = db.prepare(
      'UPDATE devices SET lat = ?, lng = ?, last_seen = ? WHERE id = ?'
    );
    db.transaction((items) => {
      for (const s of items) {
        updateDevice.run(s.pos.lat, s.pos.lng, s.lastSeen.toISOString(), s.row.id);
      }
    })(scattered);

    // Ranking: in-radius before out-of-radius, fresh telemetry before stale,
    // then nearest first. Only in-radius candidates receive a rank and alerts.
    const sorted = scattered
      .filter((s) => s.row.has_defib === 1)
      .sort((a, b) => {
        if (a.inRadius !== b.inRadius) return a.inRadius ? -1 : 1;
        if (a.fresh !== b.fresh) return a.fresh ? -1 : 1;
        return a.distanceM - b.distanceM;
      });

    let rank = 0;
    const candidates = sorted.map((s) => ({
      deviceId: s.row.id,
      label: s.row.label,
      phone: s.row.phone,
      lat: s.pos.lat,
      lng: s.pos.lng,
      locationSource: s.row.location_source,
      battery: s.row.battery,
      kind: s.row.kind,
      hasLora: s.row.has_lora === 1,
      hasMagnus: s.row.has_magnus === 1,
      lastSeen: s.lastSeen,
      distanceM: Math.round(s.distanceM),
      inRadius: s.inRadius,
      rank: s.inRadius ? ++rank : null,
      alerts: {
        push: s.inRadius,
        sms: s.inRadius,
        loraDownlink: s.inRadius && s.row.has_lora === 1,
      },
    }));

    const meshNodes = scattered
      .filter((s) => s.row.has_defib === 0)
      .map((s) => ({
        deviceId: s.row.id,
        label: s.row.label,
        lat: s.pos.lat,
        lng: s.pos.lng,
        lastSeen: s.lastSeen,
      }));

    // Save the incident first so the alert-log entries can reference its _id.
    const incident = await Incident.create({
      location: { lat, lng },
      radiusM,
      status: 'active',
      source: 'simulator',
      candidates,
      meshNodes,
    });

    // Hybrid dispatch log: cellular push for every in-radius candidate, plus a
    // LoRa downlink (beep + flash) command for the ones carrying a LoRa unit.
    const logs = [];
    for (const c of candidates) {
      if (!c.inRadius) continue;
      logs.push({
        type: 'incident_push',
        deviceId: c.deviceId,
        deviceLabel: c.label,
        incidentId: incident._id,
        message: `התראת הזנקה נשלחה לטלפון של ${c.label}`,
      });
      if (c.hasLora) {
        logs.push({
          type: 'incident_lora_downlink',
          deviceId: c.deviceId,
          deviceLabel: c.label,
          incidentId: incident._id,
          message: `פקודת Downlink — צפצוף והבהוב הופעלו על ${c.label}`,
        });
      }
    }
    if (logs.length > 0) await AlertLog.insertMany(logs);

    res.status(201).json({ incident: serializeIncident(incident) });
  })
);

// GET /api/incidents — analytics list. Admin only.
router.get(
  '/',
  requireAdmin,
  wrap(async (req, res) => {
    const docs = await Incident.find().sort({ createdAt: -1 }).lean();
    const incidents = docs.map((inc) => {
      const candidates = inc.candidates ?? [];
      const responder = inc.responder?.deviceId != null ? inc.responder : null;
      const createdMs = new Date(inc.createdAt).getTime();
      return {
        id: String(inc._id),
        createdAt: inc.createdAt,
        location: inc.location,
        radiusM: inc.radiusM,
        status: inc.status,
        responder,
        candidateCount: candidates.length,
        inRadiusCount: candidates.filter((c) => c.inRadius).length,
        acceptSeconds: responder?.acceptedAt
          ? Math.round((new Date(responder.acceptedAt).getTime() - createdMs) / 1000)
          : null,
        responseSeconds: inc.arrivedAt
          ? Math.round((new Date(inc.arrivedAt).getTime() - createdMs) / 1000)
          : null,
      };
    });
    res.json({ incidents });
  })
);

// GET /api/incidents/:id — single incident (call-center / responder view). Public.
router.get(
  '/:id',
  wrap(async (req, res) => {
    const incident = await findIncidentOr404(req, res);
    if (!incident) return;
    res.json({ incident: serializeIncident(incident) });
  })
);

// POST /api/incidents/:id/accept — a candidate volunteer takes the call.
router.post(
  '/:id/accept',
  wrap(async (req, res) => {
    const incident = await findIncidentOr404(req, res);
    if (!incident) return;
    if (incident.status !== 'active') {
      return res
        .status(409)
        .json({ error: 'wrong_status', message: 'לאירוע כבר הוקצה מתנדב' });
    }
    const deviceId = Number(req.body?.deviceId);
    const candidate = incident.candidates.find((c) => c.deviceId === deviceId);
    if (!candidate) {
      return res
        .status(400)
        .json({ error: 'invalid_candidate', message: 'המכשיר אינו ברשימת המועמדים לאירוע זה' });
    }
    incident.responder = {
      deviceId: candidate.deviceId,
      label: candidate.label,
      phone: candidate.phone,
      acceptedAt: new Date(),
    };
    incident.status = 'responding';
    await incident.save();
    res.json({ incident: serializeIncident(incident) });
  })
);

// POST /api/incidents/:id/breadcrumb — live position report to the call center.
router.post(
  '/:id/breadcrumb',
  wrap(async (req, res) => {
    const incident = await findIncidentOr404(req, res);
    if (!incident) return;
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'validation', message: 'נקודת מיקום לא תקינה' });
    }
    const distanceRemainingM = Number(req.body?.distanceRemainingM);
    incident.breadcrumbs.push({
      lat,
      lng,
      at: new Date(),
      distanceRemainingM: Number.isFinite(distanceRemainingM) ? distanceRemainingM : null,
    });
    // Cap the trail so a long-running demo cannot grow the document unbounded.
    if (incident.breadcrumbs.length > MAX_BREADCRUMBS) {
      incident.breadcrumbs.splice(0, incident.breadcrumbs.length - MAX_BREADCRUMBS);
    }
    await incident.save();
    res.json({ ok: true });
  })
);

// POST /api/incidents/:id/arrived — responder reached the victim.
router.post(
  '/:id/arrived',
  wrap(async (req, res) => {
    const incident = await findIncidentOr404(req, res);
    if (!incident) return;
    const arrivedAt = new Date();
    incident.arrivedAt = arrivedAt;
    incident.resolvedAt = arrivedAt;
    incident.status = 'resolved';
    await incident.save();
    const responseSeconds = Math.round(
      (arrivedAt.getTime() - incident.createdAt.getTime()) / 1000
    );
    res.json({ incident: serializeIncident(incident), responseSeconds });
  })
);

// POST /api/incidents/:id/cancel — abort the drill / false alarm.
router.post(
  '/:id/cancel',
  wrap(async (req, res) => {
    const incident = await findIncidentOr404(req, res);
    if (!incident) return;
    incident.status = 'cancelled';
    incident.resolvedAt = new Date();
    await incident.save();
    res.json({ incident: serializeIncident(incident) });
  })
);

export default router;
