# DefiNet (דפי-נט) — Architecture & Contracts

> **This document is the single source of truth** for data models, API contracts, and frontend
> conventions. Every module MUST follow it exactly. If you change a contract, update this file.

## 1. What we are building

A Hebrew-first (RTL) web system that maps **stationary and moving defibrillators** in real time,
alerts nearby volunteers on a cardiac-arrest distress call over **two channels simultaneously**
(cellular push/SMS + LoRa downlink beep/flash), and includes a **web demo simulator** (no physical
hardware). Location sources per moving device, in preference order:

1. **MAGNUS satellite radio** (Iridium network, Garmin inReach-based, Israeli 24/7 rescue desk) — works everywhere.
2. **LoRa beacon** (433 MHz) relayed over a **Meshtastic** mesh; ambulances act as LoRa↔Internet gateways.
3. **Phone GPS** — only where there is cellular reception.

Official channels always come first: emergency **101 (MDA)** and **defi.co.il**.
This is a course project ("Development on Web Platforms"); marketing quality of the interfaces is graded heavily.

## 2. Runtime topology (two servers)

```
Browser ──► Next.js 15 (web/, port 3000)  ── marketing pages, simulator UI, admin UI
   │
   └──────► Express  (server/, port 4000) ── /api/*  JWT+refresh auth, registry, incidents, CMS
                 ├── SQLite  (better-sqlite3)  = SQL DB: users, devices, admins, refresh_tokens
                 └── MongoDB (mongoose)        = NoSQL DB: incidents, content pages, alert log,
                                                 telemetry log, simulator config
```

- Web calls the API directly with CORS + `credentials:'include'` (refresh cookie).
- Local dev: when `MONGODB_URI` is empty, a local MongoDB starts automatically via
  `mongodb-memory-server` with a **persistent data directory** (`server/data/mongo`) — CMS edits,
  incidents and alert history survive restarts; deleting the directory resets to defaults.
- Production ($0 tiers): Vercel (web) + Render (api) + MongoDB Atlas M0. SQLite lives on the API dyno
  and re-seeds itself on boot if empty (documented known limitation).

## 3. Repo layout & module ownership

```
/package.json               npm workspaces root (concurrently dev script)
/docs/ARCHITECTURE.md       this file
/server
  src/index.js              bootstrap: env → sqlite → mongo → seed → listen        [core]
  src/app.js                express app, CORS, route mounting                       [core]
  src/db/sqlite.js          better-sqlite3 init + DDL                               [core]
  src/db/mongo.js           mongoose connect (+memory fallback) + ALL models        [core]
  src/lib/rng.js            seeded RNG (mulberry32)                                 [core]
  src/seed.js               ensureSeed(): admin + 50 devices; ensureMongoDefaults   [core]
  src/data/default-content.js  default Hebrew CMS content for all marketing pages   [C1]
  src/middleware/requireAdmin.js  Bearer access-token guard                         [B1]
  src/routes/auth.js        login / refresh (rotation) / logout / me                [B1]
  src/routes/registry.js    POST /register, volunteers CRUD, GET /stats             [B2]
  src/routes/incidents.js   incident engine: scatter, geo-fence, rank, alerts       [B3]
  src/lib/geo.js            haversine, scatter helpers                              [B3]
  src/routes/telemetry.js   GET /devices, device telemetry, tick, alerts            [B4]
  src/routes/content.js     CMS content GET/PUT                                     [B4]
  src/routes/config.js      simulator config GET/PUT                                [B4]
/web
  app/layout.jsx            RTL Hebrew shell, Heebo font, Nav+Footer                [core]
  app/globals.css           tailwind + leaflet css                                  [core]
  components/Nav.jsx, Footer.jsx, ui.jsx     shared UI kit                          [core]
  components/OfficialChannels.jsx  101 + defi.co.il + MDA strip (emergency surfaces) [core]
  lib/api.js                apiFetch / adminFetch (auto-refresh) / fetchContent     [core]
  lib/format.js             Hebrew relative time, distances, labels                 [core]
  lib/sound.js              WebAudio beep / SOS / metronome                         [core]
  app/page.jsx + components/home/*           home page + LoRa/SMS SVG diagram      [F1]
  app/guide|join|shop|maintenance/page.jsx + components/marketing/*                 [F2]
  app/register/page.jsx + components/register/*                                     [F3]
  app/simulator/page.jsx, app/incident/[id]/page.jsx + components/map/*             [F4]
  app/cpr/page.jsx + components/cpr/*                                               [F5]
  app/admin/** (EXCEPT admin/analytics) + components/admin/*                        [F6]
  app/admin/analytics/page.jsx + components/admin-analytics/*                       [F7]
```

**Rule: modules only create/modify files inside their ownership set.** Stubs exist for every route
file and page — overwrite them.

## 4. SQL schema (SQLite — `server/src/db/sqlite.js`)

```sql
admins(id INTEGER PK, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT)

users(
  id INTEGER PK, first_name TEXT NOT NULL, last_name TEXT, phone TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('defib_lora','defib_only','lora_only')),
  lora_id TEXT UNIQUE,             -- DevEUI; NULL only allowed for defib_only
  medical_training TEXT,           -- free text, optional
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)

devices(
  id INTEGER PK, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,             -- e.g. 'דפיברילטור נייד – דנה לוי'
  dev_eui TEXT UNIQUE,             -- mirrors users.lora_id when present
  kind TEXT NOT NULL CHECK(kind IN ('stationary','mobile')),
  has_defib INTEGER NOT NULL DEFAULT 1,   -- 0 for lora_only mesh repeaters
  has_lora INTEGER NOT NULL DEFAULT 0,
  has_magnus INTEGER NOT NULL DEFAULT 0,
  battery INTEGER,                 -- NULL for phone-only devices
  status TEXT NOT NULL DEFAULT 'ok' CHECK(status IN ('ok','fault')),
  lat REAL, lng REAL,
  location_source TEXT CHECK(location_source IN ('lora','magnus','phone')),
  last_seen TEXT,                  -- ISO string
  created_at TEXT DEFAULT (datetime('now'))
)

refresh_tokens(id INTEGER PK, jti TEXT UNIQUE NOT NULL, username TEXT NOT NULL,
               expires_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created_at TEXT)
```

Category semantics (eligibility, requirement 8): `defib_lora` = portable defibrillator + LoRa unit;
`defib_only` = portable defibrillator tracked by phone only; `lora_only` = LoRa carrier without a
defibrillator (mesh repeater, the $50 program). **LoRa ID is mandatory except for `defib_only`**
(documented interpretation of requirements 6+8).

## 5. NoSQL models (MongoDB — `server/src/db/mongo.js`, all exported)

```js
Incident {
  location:{lat,lng}, radiusM:Number,
  status:'active'|'responding'|'resolved'|'cancelled', source:'simulator'|'app'|'call_center',
  candidates:[{ deviceId, label, phone, lat, lng, locationSource, battery, kind,
                hasLora, hasMagnus, lastSeen:Date, distanceM, inRadius:Boolean, rank:Number,
                alerts:{ push:Boolean, sms:Boolean, loraDownlink:Boolean } }],   // defib devices only
  meshNodes:[{ deviceId, label, lat, lng, lastSeen:Date }],                      // lora_only repeaters
  responder:{ deviceId, label, phone, acceptedAt:Date },
  breadcrumbs:[{ lat, lng, at:Date, distanceRemainingM:Number }],
  arrivedAt:Date, resolvedAt:Date, timestamps:true
}
ContentPage { key:String unique, title, intro, sections:[{heading,body}],
              links:[{label,url,description}], updatedBy, timestamps:true }
AlertLog  { type:'maintenance_battery'|'incident_push'|'incident_sms'|'incident_lora_downlink',
            deviceId, deviceLabel, incidentId?, message, timestamps:true }
TelemetryLog { deviceId, channel:'lora'|'magnus'|'phone', battery, lat, lng, timestamps:true }
SimConfig { key:'sim' unique, radiusM:1500, scatterFactor:2.5, freshTelemetryMinutes:10,
            defaultCenter:{lat:32.0809,lng:34.7806} }
```

## 6. API contract (Express, all JSON)

Base URL: `http://localhost:4000`. Errors: `{ error:'<code>', message?:string, fields?:{name:hebrewMsg} }`.
`fields` values are **Hebrew** user-facing messages.

**Privacy rule:** PUBLIC endpoints never return a full phone number — `lib/phone.js maskPhone()`
masks them (`052***4567`) in `GET /api/devices` and in every incident serialization
(candidates + responder). Full numbers are admin-only (`/api/volunteers`, analytics list).

### Auth — `routes/auth.js` [B1]
| Method & path | Body / notes | Response |
|---|---|---|
| POST `/api/auth/login` | `{username,password}` — bcrypt vs `admins` | `{accessToken, admin:{username}}` + refresh cookie. 401 `invalid_credentials` |
| POST `/api/auth/refresh` | reads cookie; verify JWT + jti live in `refresh_tokens` → **rotate** (revoke old jti, new cookie) | `{accessToken}`; 401 otherwise |
| POST `/api/auth/logout` | revoke jti, clear cookie | `{ok:true}` |
| GET `/api/auth/me` | Bearer | `{admin:{username}}` |

Access JWT `{sub,role:'admin'}` 15 min, `ACCESS_TOKEN_SECRET`. Refresh JWT `{sub,jti}` 7 days,
`REFRESH_TOKEN_SECRET`, cookie `refresh_token`: httpOnly, `path:'/api/auth'`,
`sameSite: prod?'none':'lax'`, `secure: prod`, maxAge 7d.
`requireAdmin` middleware: verifies Bearer access token → `req.admin={username}` else 401 `unauthorized`.

### Registry — `routes/registry.js` [B2]
| POST `/api/register` | public, **no password** (req 15). Body `{firstName!, lastName?, phone!, category!, loraId, medicalTraining?}`. Validate: firstName trimmed non-empty; phone Israeli mobile `/^05\d{8}$/` after stripping `[-\s]`; category one of 3; **loraId required unless category==='defib_only'**, format `/^[0-9A-Fa-f]{4,23}$/`, unique. Creates user + device (`has_defib = category!=='lora_only'`, `has_lora = category!=='defib_only'`, `kind:'mobile'`, battery 100 when has_lora else NULL, `location_source` `'lora'`/`'phone'`, label `דפיברילטור נייד – <name>` or `מגבר רשת LoRa – <name>`, last_seen now, lat/lng NULL). | 201 `{user, device}`; 400 `validation` with Hebrew `fields`; 409 `duplicate` (loraId) |
| GET `/api/volunteers?query=&category=` | admin. Joins users+devices, search on name/phone/lora_id | `{volunteers:[{id, firstName, lastName, phone, category, loraId, medicalTraining, isSeed, createdAt, device:{id,label,battery,lastSeen,kind,status,hasLora,hasMagnus}}]}` |
| PUT `/api/volunteers/:id` | admin; partial update, same validation; sync device dev_eui/label | `{volunteer}` |
| DELETE `/api/volunteers/:id` | admin; cascades to device | `{ok:true}` |
| GET `/api/stats` | public | `{volunteers, devices, withLora, withMagnus, stationary, mobile, repeaters}` |

### Incidents — `routes/incidents.js` [B3]
POST `/api/incidents` `{lat!, lng!, radiusM?}` (public — the simulator/citizen app):
1. Read `SimConfig` (radius default), all `status='ok'` devices.
2. **Scatter (requirement 9):** every device gets a random position uniform within
   `radiusM * scatterFactor` of the incident + randomized `last_seen` recency weighted fresh
   (~50% within `freshTelemetryMinutes`, rest up to 120 min). Persist to SQLite.
3. Haversine `distanceM` per device (`lib/geo.js`), `inRadius = distanceM <= radiusM`.
4. Candidates = `has_defib=1`; rank in-radius first by freshness bucket (lastSeen ≤ freshTelemetryMinutes), then distance asc; `rank` 1..n for inRadius, null outside.
5. Alerts for inRadius candidates: `push:true, sms:true, loraDownlink:hasLora`; write AlertLog docs.
6. `meshNodes` = devices with `has_defib=0`.
7. Save + return 201 `{incident}` (Mongo `_id` serialized as `id`).

| GET `/api/incidents` | admin (analytics) | `{incidents:[{id,createdAt,location,radiusM,status,responder,candidateCount,inRadiusCount, acceptSeconds, responseSeconds}]}` (seconds null until known) |
| GET `/api/incidents/:id` | public | `{incident}` |
| POST `/api/incidents/:id/accept` `{deviceId}` | sets responder from candidates, status `responding` | `{incident}` |
| POST `/api/incidents/:id/breadcrumb` `{lat,lng,distanceRemainingM}` | push (cap 500) — the "report to call center" | `{ok:true}` |
| POST `/api/incidents/:id/arrived` | arrivedAt, resolvedAt, status `resolved` | `{incident, responseSeconds}` |
| POST `/api/incidents/:id/cancel` | status `cancelled` | `{incident}` |

### Fleet & telemetry — `routes/telemetry.js` [B4]
| GET `/api/devices` | public | `{devices:[{id,label,kind,hasDefib,hasLora,hasMagnus,battery,status,lat,lng,locationSource,lastSeen, owner:{firstName,lastName,phone,category}}]}` |
| POST `/api/devices/:id/telemetry` `{battery?,lat?,lng?,channel?}` | simulated LoRa "tweet": update row + TelemetryLog; **battery crossing below 20 → AlertLog `maintenance_battery`** (only on crossing) | `{device, alert:null|log}` |
| POST `/api/telemetry/tick` | public (demo): one silent-update cycle — LoRa/Magnus devices drain 0–2%, mobiles jitter ±300m, ~70% refresh last_seen, crossings alert | `{updated, alerts:[...]}` |
| GET `/api/alerts?limit=50` | admin | `{alerts:[AlertLog]}` |

### CMS content — `routes/content.js` [B4]
| GET `/api/content` | public | `{pages:[{key,title,updatedAt}]}` |
| GET `/api/content/:key` | public; 404 `not_found` | `{page}` |
| PUT `/api/content/:key` | admin; body `{title,intro,sections,links}`, upsert, `updatedBy` | `{page}` |

### Simulator config — `routes/config.js` [B4]
GET `/api/config` (public) → `{config}` · PUT `/api/config` (admin, partial) → `{config}`

## 7. Frontend conventions (ALL frontend modules)

- **Everything user-facing is Hebrew.** Layout is already `dir="rtl" lang="he"`. Use logical Tailwind
  utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`) — never `ml/mr/pl/pr` unless direction-proof.
- Design tokens: primary **emerald-600** (AED-signage green), emergency **red-600**, neutrals slate,
  background `slate-50`, cards white `rounded-2xl border-slate-200 shadow-sm`. Font Heebo (loaded).
- Reuse the UI kit `components/ui.jsx`: `Button` (variants `primary|emergency|outline|ghost`),
  `Card`, `PageHero`, `Section`, `Badge`, `Field`, `Input`, `Select`, `TextArea`, `Alert`.
- API access via `lib/api.js` only: `apiFetch(path,{method,body})`, admin calls `adminFetch`
  (auto refresh-retry), public CMS via `fetchContent(key)` (returns `{page}` or null — render a
  graceful fallback if null). Marketing pages: **server components** fetching CMS with `cache:'no-store'`;
  interactive parts are nested `'use client'` components.
- Formatting: `lib/format.js` — `relativeTimeHe(iso)`, `formatDistanceM(m)`, `categoryLabel(cat)`,
  `sourceLabel(src)`, `formatDateTimeHe(iso)`.
- Sounds: `lib/sound.js` — `beep()`, `sosBeep()`, `startMetronome(bpm)`, `stopMetronome()`.
- Leaflet: CSS is already imported globally. Build maps with **plain leaflet** inside `'use client'`
  components: `useEffect` + `import('leaflet')` dynamic import (SSR-safe), `L.divIcon` custom markers
  (default icon images break under bundlers). OSM tiles:
  `https://tile.openstreetmap.org/{z}/{x}/{y}.png` attribution `© OpenStreetMap contributors`.
- Bike routing (requirement 10 — bike paths, not aerial lines), $0 and key-free (FOSSGIS OSRM):
  `https://routing.openstreetmap.de/routed-bike/route/v1/bike/{fromLng},{fromLat};{toLng},{toLat}?overview=full&geometries=geojson`
  → `routes[0].geometry.coordinates` ([lng,lat] pairs — flip for Leaflet), `distance` m, `duration` s.
  On fetch failure fall back to a straight dashed line + warning ("מסלול משוער — שירות הניווט אינו זמין").
- **Official channels come first.** Every *emergency* surface (`/simulator`, `/cpr`,
  `/incident/[id]`) must render `<OfficialChannels />` — the 101 dial button plus the two
  authoritative maps — because the project brief requires prioritizing "Where is Defi" and 101
  over DefiNet itself. The Footer carries the same links site-wide as the baseline.
- External links (fixed registry — use exactly these):
  - MDA national defibrillator registry: `https://www.mdais.org/about/mdefi` (label: מאגר הדפיברילטורים הלאומי של מד״א)
  - Where is Defi: `https://defi.co.il/#/map`
  - Meshtastic: `https://meshtastic.org`
  - Shops (433 MHz emphasis): LILYGO `https://lilygo.cc`, Heltec `https://heltec.org`,
    AliExpress search `https://www.aliexpress.com/w/wholesale-lora-433mhz-meshtastic.html`
- Never `alert()`/`confirm()` — use inline UI. No new npm dependencies. Do not run npm/servers.

## 8. Page inventory

| Route | Owner | Content |
|---|---|---|
| `/` | F1 | Hero + 3-line LoRa explanation (exactly 3 numbered lines — requirement 4), SVG distress-flow diagram (LoRa/Meshtastic mesh→gateway→server path AND SMS path with owner+location+phone), live stats from `/api/stats`, CMS sections, CTA to /register + /simulator |
| `/guide` | F2 | How the tech works: LoRa, Meshtastic, MAGNUS satellite, hybrid alerting, honest simple explanations |
| `/join` | F2 | The $50 repeater program, 3 join paths (req: defib+LoRa attach, defib phone-only, LoRa-only), each path → /register?category=... |
| `/shop` | F2 | Marketing of LoRa hardware, ≥3 shopping links, **433 MHz** emphasized, Meshtastic device guidance |
| `/maintenance` | F2 | Battery/status upkeep, silent daily LoRa "tweet", <20% auto-alert explanation |
| `/register` | F3 | The central registration form (req 6+8): category picker drives conditional LoRa ID; Hebrew validation; success screen with summary; reads `?category=` |
| `/simulator` | F4 | Interactive demo: map, radius config, click-to-place distress, POST incident, radius circle, scattered devices w/ lastSeen, ranked sidebar, alert animations (push icon + blinking/beeping LoRa downlink), accept → bike route + breadcrumb animation + distance reports, arrival → response time + CPR link |
| `/incident/[id]` | F4 | Call-center view of one incident: map snapshot, status, responder, breadcrumb trail, distance remaining |
| `/cpr` | F5 | CPR guidance (extra feature): steps, 100–110 BPM metronome with WebAudio + pulse animation, AED usage, 101 first |
| `/admin` | F6 | Login (micha/1234) → panel shell: dashboard, content editor (all CMS pages), volunteers table (search/edit/delete), config, alerts log |
| `/admin/analytics` | F7 | Response-time analytics (extra feature): SVG charts, stat tiles |

## 9. Environment variables

Server: `PORT` (4000), `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `MONGODB_URI` (optional →
local persistent fallback), `CLIENT_ORIGIN` (CORS + cookies). Web: `NEXT_PUBLIC_API_URL`.

## 10. Seed data (requirement 9)

`server/src/seed.js` — deterministic (mulberry32 seed 42): admin `micha`/`1234` (bcrypt), and 50
users+devices when empty: 14 stationary (8 LoRa), 14 mobile defib+LoRa (7 of them +MAGNUS),
12 mobile defib phone-only, 10 LoRa-only repeaters. Hebrew names, Israeli 05X phones, positions
jittered around 10 Israeli cities, batteries 10–100 (four already <20% as a maintenance backlog,
three at a 20–21% "brink" so one silent-update tick crosses the alert threshold live),
last_seen 0–36h. Mongo defaults: CMS pages from `data/default-content.js` + SimConfig.
