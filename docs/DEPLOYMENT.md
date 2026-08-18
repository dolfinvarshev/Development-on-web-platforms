# Cloud Deployment — step by step (total cost: $0)

Every service below is genuinely free on the tiers we use. The order matters:
database first, then the API, then the site.

## Step 0 — GitHub

✅ Done — the repository lives at:
https://github.com/dolfinvarshev/Development-on-web-platforms

## Step 1 — MongoDB Atlas (NoSQL, free)

1. Sign up at https://www.mongodb.com/cloud/atlas → create a free **M0 cluster** (nearby region).
2. *Database Access* → create a database user with a password.
3. *Network Access* → Allow access from anywhere (0.0.0.0/0).
4. *Connect → Drivers* → copy the connection string (`mongodb+srv://...`) — this becomes
   `MONGODB_URI` (replace `<password>` with the real one and add the DB name: `/definet`).

## Step 2 — Render (the Express server, free)

1. Sign up at https://render.com with your GitHub account → New → Web Service → pick the repo.
2. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Environment variables:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | the string from step 1 |
   | `ACCESS_TOKEN_SECRET` | a long random string (e.g. from `openssl rand -hex 32`) |
   | `REFRESH_TOKEN_SECRET` | a different long random string |
   | `CLIENT_ORIGIN` | the Vercel address from step 3 (can be updated afterwards) |
4. Deploy → copy the service URL (e.g. `https://definet-api.onrender.com`).
5. Check: `https://<render-url>/api/health` must return `{"ok":true,...}`.
   On first boot the server automatically seeds the admin + the 50 demo devices.

> Note: the server **fails hard on boot** if `NODE_ENV=production` and the JWT secrets are
> missing — that is intentional (never sign tokens with the public dev fallback).

## Step 3 — Vercel (the Next.js site, free)

1. Sign up at https://vercel.com with your GitHub account → Add New Project → pick the repo.
2. Settings:
   - **Root Directory:** `web`
   - Framework Preset: Next.js (auto-detected)
3. Environment variables:
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | the Render URL from step 2 (no trailing `/`) |
4. Deploy → you get an address (e.g. `https://definet.vercel.app`).
5. Go back to Render and set `CLIENT_ORIGIN` to the exact Vercel address (including `https://`,
   no trailing `/`) — this enables CORS + the cross-site refresh cookie.

## Step 4 — Cloud acceptance checks

- [ ] The home page loads in Hebrew with the diagram
- [ ] Registering a new user works (`/register`)
- [ ] The simulator creates an incident, ranks candidates and draws a bike route (`/simulator`)
- [ ] Admin login `micha`/`1234` works; a content edit saves and appears on the site (`/admin`)
- [ ] The analytics dashboard shows the incident you created (`/admin/analytics`)

## Important notes

- **Render Free sleeps** after ~15 minutes of inactivity; the first request afterwards can take
  50 seconds or more (Render's own warning).
  Before presenting — open `/api/health` a minute in advance to wake the server.
- **SQLite on Render Free does not persist** across deploys — the system re-seeds itself
  automatically (fine for the demo and the defense; disclosed on the known-issues slide).
- After deploying, update the cloud address in the main README and on slide 1 of the deck.
