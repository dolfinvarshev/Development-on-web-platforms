import 'dotenv/config';
import { createApp } from './app.js';
import { initSqlite } from './db/sqlite.js';
import { connectMongo } from './db/mongo.js';
import { ensureSeed, ensureMongoDefaults } from './seed.js';

const PORT = process.env.PORT || 4000;

async function main() {
  initSqlite();
  await connectMongo();
  const { seeded } = ensureSeed();
  if (seeded) console.log('[seed] database was empty — seeded 50 demo devices + admin');
  await ensureMongoDefaults();
  const app = createApp();
  app.listen(PORT, () => console.log(`[api] DefiNet API listening on http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error('[api] fatal startup error:', err);
  process.exit(1);
});
