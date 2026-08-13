# Defense Deck — DefiNet (דפי-נט)

> Ready-to-present content (PowerPoint / Google Slides). Slide structure follows the
> submission requirements.
>
> **Generated deck file:** [DefiNet-Defense-Deck.pptx](DefiNet-Defense-Deck.pptx) — 6 slides, English.
> Still to fill in: author names, GitHub URL is set, cloud URL after deployment (slide 1).

---

## Slide 1 — Project details

**DefiNet (דפי-נט) — Smart Defibrillator Network**
Course project — "Development on Web Platforms"

- **Authors:** _[partner 1]_ · _[partner 2]_
- **GitHub:** https://github.com/dolfinvarshev/Development-on-web-platforms
- **Cloud address:** _[https://<app>.vercel.app]_ (API: _[https://<api>.onrender.com]_)
- **Admin login for the demo:** `micha` / `1234`

---

## Slide 2 — Known issues (honest disclosure)

> Full disclosure — an issue discovered during the defense that was not declared here costs
> significant points.

1. **Render Free "sleeps"** after ~15 min of inactivity — the first API request is slow (~30s).
   Demo workaround: open `/api/health` a minute in advance to wake the server.
2. **SQLite on the free cloud tier is not persistent** — every deploy re-seeds the data
   (the 50 demo devices return). Locally everything persists.
3. **Local MongoDB** (mongodb-memory-server) keeps data in a persistent local directory;
   deleting `server/data` resets to the demo data. In the cloud we use MongoDB Atlas.
4. **The routing service** (public OSRM, free) is a third-party dependency; on failure the UI
   shows an approximate straight line with a notice.
5. **Real SMS/Push are not sent** — they are simulated in the simulator and recorded in the
   alert log (real SMS is never free and is not required for this course project).
6. **Database network exposure** — the Atlas IP allow-list is `0.0.0.0/0` because Render's free
   tier has no static outbound IP. Access remains authenticated (user + password over TLS) and
   the cluster holds demo data only; VPC peering / static-IP allow-listing requires paid tiers.

---

## Slide 3 — Architecture

```
Browser ──► Next.js 15 + Tailwind  (Vercel · port 3000)
              │  marketing (CMS) · map simulator (Leaflet) · admin panel · analytics
              ▼  fetch + CORS + refresh cookie
          Express  (Render · port 4000) — REST API
              │  JWT + refresh rotation · incident engine · geo-fencing
              ├──► SQLite  (SQL)   — users · devices · admins · refresh_tokens
              └──► MongoDB (NoSQL) — incidents · content · alerts · telemetry · config
```

- **Two servers:** Next.js (UI + SSR) and Express (auth + business logic) — one of them Express
  with JWT refresh, per the requirement.
- **Two databases:** SQL for tabular data with relations and constraints; NoSQL for rich
  incident documents and flexible content.
- **Three location channels:** cellular · LoRa 433MHz (Meshtastic) · MAGNUS satellite (Iridium) —
  MAGNUS preferred when both exist.

---

## Slide 4 — Code sample: the incident engine (geo-fencing + ranking)

The core of `server/src/routes/incidents.js` — what happens on every distress call:

```js
// 1. Random scatter of all 50 devices around the incident (requirement 9)
const scattered = rows.map((row) => {
  const pos = scatterAround(lat, lng, radiusM * cfg.scatterFactor);
  const distanceM = haversineM(lat, lng, pos.lat, pos.lng);
  return { row, pos, distanceM, inRadius: distanceM <= radiusM, ... };
});
// 2. Ranking: in-radius first, fresh transmission before stale, then distance
const sorted = scattered.filter((s) => s.row.has_defib === 1).sort((a, b) => {
  if (a.inRadius !== b.inRadius) return a.inRadius ? -1 : 1;
  if (a.fresh   !== b.fresh)     return a.fresh   ? -1 : 1;
  return a.distanceM - b.distanceM;
});
```

**Defense points:** the haversine formula and meters→degrees conversion; uniform disk sampling
(`r = R·√U`); a stable three-key sort; only in-radius candidates receive a rank and a dispatch.

---

## Slide 5 — Code sample: JWT with refresh rotation

From `server/src/routes/auth.js` — every refresh token is single-use:

```js
router.post('/refresh', (req, res) => {
  const session = verifyRefreshCookie(req);          // JWT + live jti row in the DB
  if (!session) return res.status(401).json({ error: 'unauthorized' });
  db.transaction(() => {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?').run(session.jti);
    issueRefreshToken(res, session.username);         // new jti + new cookie
  })();
  res.json({ accessToken: signAccessToken(session.username) });
});
```

**Defense points:** short access token (15 min, in memory) vs long refresh token (7 days,
httpOnly cookie); rotation → a stolen cookie dies on first reuse; on the client,
`refreshAccessToken` is single-flight so concurrent calls can't kill the session.

---

## Slide 6 — Code sample: the hybrid alert + the simulator

From `server/src/routes/incidents.js` — two channels in parallel for every in-radius candidate:

```js
logs.push({ type: 'incident_push', ... });                 // cellular: Push
logs.push({ type: 'incident_sms',  ... });                 // cellular: SMS (name, phone, location)
if (c.hasLora) logs.push({ type: 'incident_lora_downlink', ... }); // LoRa: beep + flash
```

On the client (`web/components/map/SimulatorApp.jsx`): routing goes through **OSRM cycling**
(a real bike route, requirement 10), the volunteer is animated along it, and breadcrumbs are
POSTed to the dispatch center every 2 seconds.

**Metrics for the defense:** 100% requirements coverage · two databases · two servers · two bonus
features (CPR screen with a 110 BPM metronome, response-time analytics dashboard).
