# DefiNet (דפי-נט) — Smart Defibrillator Network

**Course project — "Development on Web Platforms"** — a real-time mapping and dispatch system for
**stationary and moving defibrillators**, inspired by [Where is Defi](https://defi.co.il/#/map)
and extending it with the one thing existing maps can't do: tracking defibrillators **in motion**,
over three location channels — cellular, LoRa 433MHz (Meshtastic mesh), and the MAGNUS satellite
service (Iridium network).

> 📦 **GitHub:** https://github.com/dolfinvarshev/Development-on-web-platforms
>
> 🌐 **Cloud address:** _to be updated after deployment_ (Vercel + Render + MongoDB Atlas — all free tiers)
>
> 👥 **Authors:** _[partner names to be filled in]_
>
> 🔑 **Admin login (for the course demo):** username `micha` · password `1234`
>
> ℹ️ Per requirement 2, the **site itself** is entirely in Hebrew (RTL). Project documentation is in English.

---

## What the system does

In cardiac arrest, every minute without a shock cuts survival by ~7–10%. DefiNet:

1. **Maps** every defibrillator in the network — stationary and mobile — including battery level
   and last transmission time, updated automatically ("silent update") over the LoRa network.
2. **Dispatches** on a distress call: a geographic computation (geo-fencing) finds the nearest,
   most available devices, and the alert goes out **on two channels simultaneously** — Push/SMS to
   the volunteer's phone, plus a LoRa **downlink** command that makes the physical device beep and flash.
3. **Navigates** the volunteer along a real bike route (not an aerial line) to the scene, and
   reports the remaining distance to the dispatch center in real time.
4. **Demonstrates** the whole end-to-end scenario in a browser-based simulator — no hardware needed.

Official channels always come first: **MDA's 101 line** and defi.co.il.

## Local installation & run

Prerequisites: **Node.js 20+** (with npm). That's all — no database installation:
SQLite is a local file, and MongoDB starts automatically in-process (with a persistent local
data directory) when `MONGODB_URI` is not set.

```bash
# 1) Clone
git clone https://github.com/dolfinvarshev/Development-on-web-platforms.git
cd Development-on-web-platforms

# 2) Install dependencies (both workspaces)
npm install

# 3) Seed the database (admin + 50 demo devices) — also runs automatically on server boot
npm run seed

# 4) Run both servers together (Express on 4000, Next.js on 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the site is entirely in Hebrew (RTL).
The API answers at [http://localhost:4000/api/health](http://localhost:4000/api/health).

Environment variables (optional for local dev): copy `server/.env.example` → `server/.env`
and `web/.env.example` → `web/.env.local`, then adjust as needed.

## Architecture (two servers · two databases)

```
Browser ──► Next.js 15 + Tailwind (web/, port 3000)
              │  marketing pages (CMS) · map simulator (Leaflet) · admin panel
              ▼
          Express (server/, port 4000) — REST API
              │  JWT with refresh rotation · incident engine · geo-fencing
              ├──► SQLite  (SQL)   — users, devices, admins, refresh tokens
              └──► MongoDB (NoSQL) — incidents, CMS content, alert log, telemetry, config
```

Full API contracts, schemas and design decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Why two databases?

- **SQLite (SQL):** tabular data with relations and constraints — users ↔ devices (foreign key,
  CASCADE), DevEUI uniqueness, refresh tokens. Fast JOINs and a rigid schema.
- **MongoDB (NoSQL):** rich, variable-shape documents — a whole incident with its candidates and
  breadcrumb trail in one document, flexible CMS content, alert and telemetry logs.

## Requirements ⇄ implementation map

| # | Requirement | Where it lives |
|---|---|---|
| 1 | Web distress simulator, no hardware | `/simulator` + the incident engine `server/src/routes/incidents.js`; the "silent update" runs autonomously every hour (`TELEMETRY_TICK_MINUTES`) and on demand via the admin-dashboard button |
| 2 | Hebrew default display + explanations | Entire site is RTL Hebrew (`web/app/layout.jsx`), `/guide` page |
| 3 | Convenient admin maintenance | `/admin` — content editing, volunteers, alerts, config |
| 4 | Home page: LoRa in 3 lines + diagram (LoRa+GPS / SMS) | `web/app/page.jsx` + `components/home/DistressFlowDiagram.jsx` |
| 5 | Distress page mapping the surroundings + call source | `/simulator` + dispatch-center view `/incident/[id]` |
| 6 | Registration: first name required, last name optional, mobile required, LoRa ID required | `/register` + double (client+server) validation |
| 7 | HTML + Tailwind (responsive) | Tailwind on every page, mobile menu |
| 8 | Eligibility: defib owner with/without LoRa, or LoRa-only | The three join tracks + enforcement in `registry.js` |
| 9 | ~50 registered users, randomly sampled on the map, shown with location + last transmission time | `server/src/seed.js` (50 devices) + per-incident scatter |
| 10 | Radius parameter in config + bike-path routing (not aerial lines) | Simulator settings (admin) + OSRM bike routing |
| 11 | Admin micha/1234 with JWT + refresh | `server/src/routes/auth.js` (full token rotation) |
| 12 | Admin edits marketing pages + manages the registry | CMS editor + volunteers table in `/admin` |
| 13 | Link to MDA's national defibrillator registry | Footer + home page + official-channels strip |
| 14 | Marketing of ≥3 LoRa shops, 433MHz emphasized | `/shop` (LILYGO, Heltec, RAKwireless, AliExpress) |
| 15 | Client registration without a password + simple explanations | Registration form — no password at all |
| Tech | 2 database types (SQL+NoSQL), 2 servers (one Express with JWT refresh) | SQLite+MongoDB · Express+Next.js |
| Bonus (5 pts) | CPR guidance screen + response-time analytics dashboard | `/cpr` (110 BPM metronome) + `/admin/analytics` |

## The end-to-end scenario (what the simulator demonstrates)

1. **Identification:** click the map to place the incident and fire a distress call.
2. **Processing:** the server scatters the 50 devices around the incident (random sampling),
   computes distances, and ranks in-radius candidates by transmission freshness, then distance.
3. **Distribution:** every in-radius candidate is logged with Push + SMS alerts; LoRa carriers also
   get a downlink command (shown as a blinking badge with a real beep).
4. **Response:** accepting the call fetches a real bike route (OSRM) and animates the volunteer
   along it, streaming breadcrumbs to the server.
5. **Reporting:** the dispatch-center view (`/incident/[id]`) shows the remaining distance live,
   and on arrival — the total response time (which feeds the analytics dashboard).

## Cloud deployment ($0 total)

| Component | Service | Notes |
|---|---|---|
| Next.js (web) | Vercel (Free) | `NEXT_PUBLIC_API_URL` → the Render API address |
| Express (server) | Render (Free) | Env vars: `MONGODB_URI`, secrets, `CLIENT_ORIGIN`, `NODE_ENV=production` |
| MongoDB | Atlas M0 (Free) | Connection string in `MONGODB_URI` |
| SQLite | On the Render disk | Auto-seeds on boot when empty |

Step-by-step deployment instructions: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
Ready-to-present slide deck (+ known-issues slide): [docs/SLIDES.md](docs/SLIDES.md).

## Known issues (honest disclosure)

- **Render Free "sleeps"** after inactivity — the first request may take ~30 seconds.
- **SQLite on the free cloud tier is not persistent** — every deploy re-seeds the data
  (the 50 demo devices return; real cloud registrations survive only until the next deploy).
  Locally everything persists.
- **Local MongoDB** (mongodb-memory-server) keeps its data in a persistent local directory
  (`server/data/mongo`) — admin edits survive restarts; deleting the directory resets to defaults.
- **The routing service** (public OSRM) is a free third party; on failure the UI shows an
  approximate straight line with a notice.
- Full, current list — on the "Known Issues" slide of the deck.

## Repository layout

```
├── server/          # Express API (port 4000)
│   └── src/
│       ├── index.js, app.js          # bootstrap + router mounting
│       ├── db/sqlite.js, db/mongo.js # the two databases
│       ├── routes/                   # auth · registry · incidents · telemetry · content · config
│       ├── middleware/requireAdmin.js
│       ├── seed.js                   # admin + 50 demo devices (deterministic)
│       └── data/default-content.js   # initial marketing content (admin-editable, Hebrew — site content)
├── web/             # Next.js 15 + Tailwind (port 3000)
│   ├── app/         # home · guide · join · shop · maintenance · register · simulator · incident/[id] · cpr · admin
│   ├── components/  # UI kit · Nav/Footer · home · marketing · register · map · cpr · admin · analytics
│   └── lib/         # api.js (incl. auto-refresh) · format.js · sound.js
└── docs/            # ARCHITECTURE.md · DEPLOYMENT.md · SLIDES.md · the defense deck
```
