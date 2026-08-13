// The "silent update" cycle (registry requirement): every LoRa/MAGNUS device
// drains a little battery, mobile units drift ~±300m, and ~70% report in with a
// fresh last_seen — exactly what a periodic fleet-wide LoRa "tweet" would do.
//
// Shared by two callers so the logic exists once:
//   1. POST /api/telemetry/tick (routes/telemetry.js) — the on-demand demo button.
//   2. The autonomous scheduler in index.js — models the spec's "the server will
//      update the table without human intervention" literally.
import { getDb } from '../db/sqlite.js';
import { AlertLog, TelemetryLog } from '../db/mongo.js';

export const LOW_BATTERY_THRESHOLD = 20;

// Maintenance alert fires only on the downward crossing of the 20% threshold, so a
// device that keeps reporting 15%, 14%, 13%... alerts exactly once. `prev >= 20` is
// false for NULL batteries, so unknown-battery devices never alert.
export function crossedLowBattery(prev, next) {
  return (
    typeof next === 'number' &&
    next < LOW_BATTERY_THRESHOLD &&
    prev !== null &&
    prev >= LOW_BATTERY_THRESHOLD
  );
}

export function batteryAlertMessage(label, battery) {
  return `סוללת המשדר של "${label}" ירדה ל-${battery}% — נשלחה התראת Push לבעל המכשיר`;
}

export function serializeAlert(doc) {
  return {
    id: String(doc._id),
    type: doc.type,
    deviceId: doc.deviceId,
    deviceLabel: doc.deviceLabel,
    incidentId: doc.incidentId ? String(doc.incidentId) : null,
    message: doc.message,
    createdAt: doc.createdAt,
  };
}

/** Runs one full silent-update cycle. Returns { updated, alerts } (alerts serialized). */
export async function runSilentUpdateCycle() {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const rows = db.prepare(`SELECT * FROM devices WHERE has_lora = 1 OR has_magnus = 1`).all();

  const updates = [];
  const crossings = [];
  const logs = [];

  for (const row of rows) {
    const battery =
      row.battery === null ? null : Math.max(0, row.battery - Math.floor(Math.random() * 3));
    let { lat, lng } = row;
    if (row.kind === 'mobile' && lat !== null && lng !== null) {
      lat += (Math.random() * 2 - 1) * 0.003;
      lng += (Math.random() * 2 - 1) * 0.003;
    }
    const refreshed = Math.random() < 0.7;

    updates.push({
      id: row.id,
      battery,
      lat,
      lng,
      lastSeen: refreshed ? nowIso : row.last_seen,
    });
    if (crossedLowBattery(row.battery, battery)) {
      crossings.push({ id: row.id, label: row.label, battery });
    }
    if (refreshed) {
      logs.push({
        deviceId: row.id,
        // A tick tweet arrives over the device's usual channel; devices seeded before
        // ever reporting have no location_source yet, so fall back to their best radio.
        channel: row.location_source ?? (row.has_magnus ? 'magnus' : 'lora'),
        battery,
        lat,
        lng,
      });
    }
  }

  const stmt = db.prepare(
    `UPDATE devices SET battery = ?, lat = ?, lng = ?, last_seen = ? WHERE id = ?`
  );
  db.transaction(() => {
    for (const u of updates) stmt.run(u.battery, u.lat, u.lng, u.lastSeen, u.id);
  })();

  if (logs.length) await TelemetryLog.insertMany(logs);
  const alertDocs = crossings.length
    ? await AlertLog.create(
        crossings.map((c) => ({
          type: 'maintenance_battery',
          deviceId: c.id,
          deviceLabel: c.label,
          message: batteryAlertMessage(c.label, c.battery),
        }))
      )
    : [];

  return { updated: updates.length, alerts: alertDocs.map(serializeAlert) };
}
