import 'dotenv/config';
import { createApp } from './app.js';
import { initSqlite } from './db/sqlite.js';
import { connectMongo } from './db/mongo.js';
import { ensureSeed, ensureMongoDefaults } from './seed.js';
import { runSilentUpdateCycle } from './lib/silent-update.js';

const PORT = process.env.PORT || 4000;

// Registry requirement: devices "tweet" once an hour/day and the server updates
// the table WITHOUT human intervention — so the silent-update cycle runs on an
// autonomous interval (default: hourly). Set TELEMETRY_TICK_MINUTES=0 to disable;
// the admin-dashboard button still triggers the same cycle on demand.
function startSilentUpdateScheduler() {
  const minutes = Number(process.env.TELEMETRY_TICK_MINUTES ?? 60);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.log('[telemetry] autonomous silent-update scheduler disabled');
    return;
  }
  const timer = setInterval(() => {
    runSilentUpdateCycle()
      .then(({ updated, alerts }) => {
        console.log(`[telemetry] silent update: ${updated} devices, ${alerts.length} alerts`);
      })
      .catch((err) => console.error('[telemetry] silent update failed:', err.message));
  }, minutes * 60 * 1000);
  // unref: the scheduler must never keep a shutting-down process alive.
  timer.unref();
  console.log(`[telemetry] autonomous silent-update cycle every ${minutes} minutes`);
}

async function main() {
  initSqlite();
  await connectMongo();
  const { seeded } = ensureSeed();
  if (seeded) console.log('[seed] database was empty — seeded 50 demo devices + admin');
  await ensureMongoDefaults();
  const app = createApp();
  app.listen(PORT, () => console.log(`[api] DefiNet API listening on http://localhost:${PORT}`));
  startSilentUpdateScheduler();
}

main().catch((err) => {
  console.error('[api] fatal startup error:', err);
  process.exit(1);
});
