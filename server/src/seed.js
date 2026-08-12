import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { initSqlite, getDb } from './db/sqlite.js';
import { connectMongo, disconnectMongo, ContentPage, SimConfig } from './db/mongo.js';
import { mulberry32 } from './lib/rng.js';
import { DEFAULT_CONTENT } from './data/default-content.js';

const FIRST_NAMES = [
  'יוסי', 'דנה', 'אבי', 'מיכל', 'רון', 'נועה', 'עומר', 'תמר', 'אלון', 'שירה',
  'איתי', 'רותם', 'עידו', 'הילה', 'גיא', 'מאיה', 'דוד', 'יעל', 'אורי', 'ליאור',
  'שרה', 'משה', 'רבקה', 'יונתן', 'עדי',
];
const LAST_NAMES = [
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אברהם', 'פרידמן', 'שפירא', 'בן-דוד',
  'גבאי', 'אזולאי', 'חדד', 'עמר', 'ברק', 'שלום', 'קדוש', 'אוחיון', 'טל', 'רוזן',
];
const CITIES = [
  { name: 'תל אביב', lat: 32.0809, lng: 34.7806 },
  { name: 'ירושלים', lat: 31.7683, lng: 35.2137 },
  { name: 'חיפה', lat: 32.794, lng: 34.9896 },
  { name: 'באר שבע', lat: 31.253, lng: 34.7915 },
  { name: 'נתניה', lat: 32.3215, lng: 34.8532 },
  { name: 'אשדוד', lat: 31.8014, lng: 34.6435 },
  { name: 'טבריה', lat: 32.7959, lng: 35.53 },
  { name: 'אילת', lat: 29.5577, lng: 34.9519 },
  { name: 'מודיעין', lat: 31.8969, lng: 35.0095 },
  { name: 'ראשון לציון', lat: 31.973, lng: 34.7925 },
];
const STATIONARY_PLACES = [
  'קניון עזריאלי', 'בית ספר אלון', 'המתנ"ס העירוני', 'הבריכה העירונית', 'בית הכנסת המרכזי',
  'המרכז הקהילתי', 'הספרייה העירונית', 'תחנת הרכבת', 'קופת חולים כללית', 'אולם הספורט',
  'מגרש הכדורגל העירוני', 'בית העירייה', 'הקונסרבטוריון', 'חוף הים המוכרז',
];
const TRAININGS = [
  'קורס החייאה של מד"א', 'חובש/ת', 'עזרה ראשונה בסיסית', 'פרמדיק/ית', null, null, 'מגיש/ת עזרה ראשונה', null,
];

/**
 * Seeds the SQL database (requirement 9): admin micha/1234 + 50 demo users & devices.
 * Deterministic (mulberry32 seed 42) so every machine gets the same demo fleet.
 * Mix: 14 stationary (8 with LoRa) · 14 mobile defib+LoRa (7 also MAGNUS) ·
 *      12 mobile defib phone-only · 10 LoRa-only mesh repeaters.
 */
export function ensureSeed() {
  const db = getDb();

  const adminRow = db.prepare('SELECT id FROM admins WHERE username = ?').get('micha');
  if (!adminRow) {
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(
      'micha',
      bcrypt.hashSync('1234', 10)
    );
  }

  const { c } = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_seed = 1').get();
  if (c > 0) return { seeded: false };

  const rand = mulberry32(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const hex = (n) =>
    Array.from({ length: n }, () => '0123456789ABCDEF'[Math.floor(rand() * 16)]).join('');

  const insertUser = db.prepare(`
    INSERT INTO users (first_name, last_name, phone, category, lora_id, medical_training, is_seed)
    VALUES (@firstName, @lastName, @phone, @category, @loraId, @training, 1)
  `);
  const insertDevice = db.prepare(`
    INSERT INTO devices (user_id, label, dev_eui, kind, has_defib, has_lora, has_magnus,
                         battery, lat, lng, location_source, last_seen)
    VALUES (@userId, @label, @devEui, @kind, @hasDefib, @hasLora, @hasMagnus,
            @battery, @lat, @lng, @locationSource, @lastSeen)
  `);

  const now = Date.now();
  const LOW_BATTERY_AT = new Set([0, 14, 22, 40]); // a few devices under 20% to demo maintenance alerts

  const tx = db.transaction(() => {
    for (let i = 0; i < 50; i++) {
      const stationary = i < 14;
      const mobileLora = i >= 14 && i < 28;
      const phoneOnly = i >= 28 && i < 40;
      const repeater = i >= 40;

      const hasLora = (stationary && i < 8) || mobileLora || repeater;
      const hasMagnus = mobileLora && i < 21;
      const hasDefib = !repeater;
      const category = repeater ? 'lora_only' : hasLora ? 'defib_lora' : 'defib_only';

      const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
      const lastName = pick(LAST_NAMES);
      const fullName = `${firstName} ${lastName}`;
      const city = pick(CITIES);

      // unique DevEUI: 14 random hex chars + index as 2 hex digits
      const loraId = hasLora ? hex(14) + i.toString(16).padStart(2, '0').toUpperCase() : null;

      const phone = `05${pick(['0', '2', '3', '4', '8'])}${String(Math.floor(rand() * 1e7)).padStart(7, '0')}`;

      let battery = null;
      if (hasLora || hasMagnus) {
        battery = LOW_BATTERY_AT.has(i) ? 10 + Math.floor(rand() * 9) : 25 + Math.floor(rand() * 76);
      }

      // last_seen: ~40% fresh (≤10 min), rest up to 36 hours ago
      const ageMs =
        rand() < 0.4 ? rand() * 10 * 60 * 1000 : rand() * 36 * 60 * 60 * 1000;
      const lastSeen = new Date(now - ageMs).toISOString();

      const label = stationary
        ? `דפיברילטור נייח – ${STATIONARY_PLACES[i]}, ${city.name}`
        : repeater
          ? `מגבר רשת LoRa – ${fullName}`
          : `דפיברילטור נייד – ${fullName}`;

      const info = insertUser.run({
        firstName,
        lastName,
        phone,
        category,
        loraId,
        training: pick(TRAININGS),
      });

      insertDevice.run({
        userId: info.lastInsertRowid,
        label,
        devEui: loraId,
        kind: stationary ? 'stationary' : 'mobile',
        hasDefib: hasDefib ? 1 : 0,
        hasLora: hasLora ? 1 : 0,
        hasMagnus: hasMagnus ? 1 : 0,
        battery,
        lat: city.lat + (rand() - 0.5) * 0.08,
        lng: city.lng + (rand() - 0.5) * 0.08,
        locationSource: hasMagnus ? 'magnus' : hasLora ? 'lora' : 'phone',
        lastSeen,
      });
    }
  });
  tx();

  return { seeded: true };
}

/** Upserts default CMS content + simulator config into MongoDB (only when missing). */
export async function ensureMongoDefaults() {
  for (const page of DEFAULT_CONTENT) {
    await ContentPage.updateOne({ key: page.key }, { $setOnInsert: page }, { upsert: true });
  }
  await SimConfig.updateOne({ key: 'sim' }, { $setOnInsert: { key: 'sim' } }, { upsert: true });
}

// Allow running directly: `npm run seed -w server`
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  initSqlite();
  await connectMongo();
  const { seeded } = ensureSeed();
  await ensureMongoDefaults();
  console.log(seeded ? '[seed] seeded 50 demo devices + admin' : '[seed] already seeded — nothing to do');
  await disconnectMongo();
  process.exit(0);
}
