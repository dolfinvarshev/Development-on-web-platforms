// [B2] Registry — public registration, admin volunteers CRUD, public stats.
// Contract: docs/ARCHITECTURE.md §6 (Registry).
import { Router } from 'express';
import { getDb } from '../db/sqlite.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

const CATEGORIES = new Set(['defib_lora', 'defib_only', 'lora_only']);
const PHONE_RE = /^05\d{8}$/;
const LORA_RE = /^[0-9A-Fa-f]{4,23}$/;

const MSG = {
  firstName: 'נא למלא שם פרטי',
  phone: 'מספר נייד ישראלי לא תקין (05XXXXXXXX)',
  category: 'נא לבחור מסלול הצטרפות',
  loraRequired: 'נא למלא מזהה LoRa (DevEUI)',
  loraFormat: 'מזהה LoRa חייב להכיל 4–23 תווים הקסדצימליים (0-9, A-F)',
  loraDuplicate: 'מזהה LoRa זה כבר רשום במערכת',
};

function normalizePhone(value) {
  return String(value ?? '').replace(/[-\s]/g, '');
}

function asObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

function deviceLabel(hasDefib, firstName, lastName) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return hasDefib ? `דפיברילטור נייד – ${fullName}` : `מגבר רשת LoRa – ${fullName}`;
}

// dev_eui mirrors users.lora_id, so uniqueness must hold across both tables.
function loraIdTaken(db, loraId, excludeUserId = null) {
  const inUsers = db
    .prepare('SELECT 1 FROM users WHERE lora_id = ? AND id IS NOT ?')
    .get(loraId, excludeUserId);
  const inDevices = db
    .prepare('SELECT 1 FROM devices WHERE dev_eui = ? AND user_id IS NOT ?')
    .get(loraId, excludeUserId);
  return Boolean(inUsers || inDevices);
}

const VOLUNTEER_SELECT = `
  SELECT
    u.id, u.first_name, u.last_name, u.phone, u.category, u.lora_id,
    u.medical_training, u.is_seed, u.created_at,
    d.id AS device_id, d.label AS device_label, d.battery AS device_battery,
    d.last_seen AS device_last_seen, d.kind AS device_kind, d.status AS device_status,
    d.has_lora AS device_has_lora, d.has_magnus AS device_has_magnus
  FROM users u
  JOIN devices d ON d.user_id = u.id
`;

function toVolunteer(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    category: row.category,
    loraId: row.lora_id,
    medicalTraining: row.medical_training,
    isSeed: Boolean(row.is_seed),
    createdAt: row.created_at,
    device: {
      id: row.device_id,
      label: row.device_label,
      battery: row.device_battery,
      lastSeen: row.device_last_seen,
      kind: row.device_kind,
      status: row.device_status,
      hasLora: Boolean(row.device_has_lora),
      hasMagnus: Boolean(row.device_has_magnus),
    },
  };
}

// POST /api/register — public, no password (requirement 15).
router.post('/register', (req, res) => {
  const db = getDb();
  const body = asObject(req.body);
  const fields = {};

  const firstName = String(body.firstName ?? '').trim();
  if (!firstName) fields.firstName = MSG.firstName;

  const lastName = String(body.lastName ?? '').trim() || null;

  const phone = normalizePhone(body.phone);
  if (!PHONE_RE.test(phone)) fields.phone = MSG.phone;

  const category = body.category;
  if (!CATEGORIES.has(category)) fields.category = MSG.category;

  const loraRaw = String(body.loraId ?? '').trim();
  let loraId = null;
  if (loraRaw) {
    if (LORA_RE.test(loraRaw)) loraId = loraRaw.toUpperCase();
    else fields.loraId = MSG.loraFormat;
  } else if (CATEGORIES.has(category) && category !== 'defib_only') {
    // LoRa ID is mandatory except for the phone-tracked defibrillator track (req 6+8).
    fields.loraId = MSG.loraRequired;
  }

  const medicalTraining = String(body.medicalTraining ?? '').trim() || null;

  if (Object.keys(fields).length) {
    return res.status(400).json({ error: 'validation', fields });
  }
  if (loraId && loraIdTaken(db, loraId)) {
    return res.status(409).json({ error: 'duplicate', fields: { loraId: MSG.loraDuplicate } });
  }

  const hasDefib = category !== 'lora_only';
  const hasLora = category !== 'defib_only';
  const label = deviceLabel(hasDefib, firstName, lastName);
  const battery = hasLora ? 100 : null;
  const lastSeen = new Date().toISOString();

  const created = db.transaction(() => {
    const userInfo = db
      .prepare(
        `INSERT INTO users (first_name, last_name, phone, category, lora_id, medical_training, is_seed)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      )
      .run(firstName, lastName, phone, category, loraId, medicalTraining);
    const userId = Number(userInfo.lastInsertRowid);
    const deviceInfo = db
      .prepare(
        `INSERT INTO devices
           (user_id, label, dev_eui, kind, has_defib, has_lora, has_magnus,
            battery, status, lat, lng, location_source, last_seen)
         VALUES (?, ?, ?, 'mobile', ?, ?, 0, ?, 'ok', NULL, NULL, ?, ?)`
      )
      .run(userId, label, loraId, hasDefib ? 1 : 0, hasLora ? 1 : 0, battery, hasLora ? 'lora' : 'phone', lastSeen);
    return { userId, deviceId: Number(deviceInfo.lastInsertRowid) };
  })();

  res.status(201).json({
    user: { id: created.userId, firstName, lastName, phone, category, loraId, medicalTraining },
    device: { id: created.deviceId, label, kind: 'mobile', hasLora, battery },
  });
});

// GET /api/volunteers?query=&category= — admin.
router.get('/volunteers', requireAdmin, (req, res) => {
  const db = getDb();
  const conditions = [];
  const params = [];

  const query = String(req.query.query ?? '').trim();
  if (query) {
    const like = `%${query}%`;
    conditions.push(
      `(u.first_name LIKE ? OR u.last_name LIKE ?
        OR (u.first_name || ' ' || COALESCE(u.last_name, '')) LIKE ?
        OR u.phone LIKE ? OR u.lora_id LIKE ?)`
    );
    // Phone column is stored normalized, so match the query with dashes/spaces stripped.
    params.push(like, like, like, `%${normalizePhone(query)}%`, like);
  }

  const category = String(req.query.category ?? '').trim();
  if (category) {
    conditions.push('u.category = ?');
    params.push(category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`${VOLUNTEER_SELECT} ${where} ORDER BY u.id DESC`).all(...params);
  res.json({ volunteers: rows.map(toVolunteer) });
});

// PUT /api/volunteers/:id — admin, partial update with the registration validation rules.
router.put('/volunteers/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const user = Number.isInteger(id) ? db.prepare('SELECT * FROM users WHERE id = ?').get(id) : undefined;
  if (!user) return res.status(404).json({ error: 'not_found' });

  const body = asObject(req.body);
  const fields = {};
  const next = {
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    category: user.category,
    loraId: user.lora_id,
    medicalTraining: user.medical_training,
  };

  if ('firstName' in body) {
    const value = String(body.firstName ?? '').trim();
    if (value) next.firstName = value;
    else fields.firstName = MSG.firstName;
  }
  if ('lastName' in body) {
    next.lastName = String(body.lastName ?? '').trim() || null;
  }
  if ('phone' in body) {
    const value = normalizePhone(body.phone);
    if (PHONE_RE.test(value)) next.phone = value;
    else fields.phone = MSG.phone;
  }
  if ('category' in body) {
    if (CATEGORIES.has(body.category)) next.category = body.category;
    else fields.category = MSG.category;
  }
  if ('loraId' in body) {
    const value = String(body.loraId ?? '').trim();
    if (!value) next.loraId = null;
    else if (LORA_RE.test(value)) next.loraId = value.toUpperCase();
    else fields.loraId = MSG.loraFormat;
  }
  if ('medicalTraining' in body) {
    next.medicalTraining = String(body.medicalTraining ?? '').trim() || null;
  }

  // The LoRa-ID requirement is evaluated against the category the update results in.
  if (!fields.loraId && next.category !== 'defib_only' && !next.loraId) {
    fields.loraId = MSG.loraRequired;
  }
  if (Object.keys(fields).length) {
    return res.status(400).json({ error: 'validation', fields });
  }
  if (next.loraId && next.loraId !== user.lora_id && loraIdTaken(db, next.loraId, id)) {
    return res.status(409).json({ error: 'duplicate', fields: { loraId: MSG.loraDuplicate } });
  }

  const device = db.prepare('SELECT * FROM devices WHERE user_id = ?').get(id);
  const nameChanged = next.firstName !== user.first_name || next.lastName !== user.last_name;
  const categoryChanged = next.category !== user.category;
  const hasDefib = next.category !== 'lora_only';
  const hasLora = next.category !== 'defib_only';

  db.transaction(() => {
    db.prepare(
      `UPDATE users
       SET first_name = ?, last_name = ?, phone = ?, category = ?, lora_id = ?, medical_training = ?
       WHERE id = ?`
    ).run(next.firstName, next.lastName, next.phone, next.category, next.loraId, next.medicalTraining, id);

    if (device) {
      // Only mobile devices carry the generated '<type> – <name>' label; stationary
      // seed devices are named after their location and must not be renamed.
      let label = device.label;
      if (device.kind === 'mobile' && (nameChanged || categoryChanged)) {
        label = deviceLabel(hasDefib, next.firstName, next.lastName);
      }
      if (categoryChanged) {
        // Keep an existing battery reading; a device that just gained LoRa starts at 100,
        // one that lost it becomes phone-tracked and reports no battery.
        const battery = hasLora ? (device.battery ?? 100) : null;
        // MAGNUS outranks LoRa in the location-source preference order (§1).
        const locationSource = device.has_magnus ? 'magnus' : hasLora ? 'lora' : 'phone';
        db.prepare(
          `UPDATE devices
           SET dev_eui = ?, label = ?, has_defib = ?, has_lora = ?, battery = ?, location_source = ?
           WHERE id = ?`
        ).run(next.loraId, label, hasDefib ? 1 : 0, hasLora ? 1 : 0, battery, locationSource, device.id);
      } else {
        db.prepare('UPDATE devices SET dev_eui = ?, label = ? WHERE id = ?').run(next.loraId, label, device.id);
      }
    }
  })();

  const row = db.prepare(`${VOLUNTEER_SELECT} WHERE u.id = ?`).get(id);
  res.json({ volunteer: toVolunteer(row) });
});

// DELETE /api/volunteers/:id — admin; the device row cascades via the FK.
router.delete('/volunteers/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const info = Number.isInteger(id)
    ? db.prepare('DELETE FROM users WHERE id = ?').run(id)
    : { changes: 0 };
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// GET /api/stats — public counters for the home page.
router.get('/stats', (req, res) => {
  const db = getDb();
  const { volunteers } = db.prepare('SELECT COUNT(*) AS volunteers FROM users').get();
  const deviceStats = db
    .prepare(
      `SELECT
         COUNT(*) AS devices,
         COALESCE(SUM(has_lora), 0) AS withLora,
         COALESCE(SUM(has_magnus), 0) AS withMagnus,
         COALESCE(SUM(CASE WHEN kind = 'stationary' THEN 1 ELSE 0 END), 0) AS stationary,
         COALESCE(SUM(CASE WHEN kind = 'mobile' THEN 1 ELSE 0 END), 0) AS mobile,
         COALESCE(SUM(CASE WHEN has_defib = 0 THEN 1 ELSE 0 END), 0) AS repeaters
       FROM devices`
    )
    .get();
  res.json({ volunteers, ...deviceStats });
});

export default router;
