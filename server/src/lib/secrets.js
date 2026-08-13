// JWT secrets — single source of truth so routes/auth.js and middleware/requireAdmin.js
// can never drift apart (a mismatch would make every issued token unverifiable).
//
// Fail hard in production rather than silently signing tokens with a public,
// repo-known dev secret: a deploy that forgot the env vars would otherwise be
// fully forgeable by anyone who read the GitHub repo. Locally the fallbacks
// keep zero-config `npm run dev` working. dotenv is loaded as the very first
// import of the entry points (index.js / seed.js), so module-scope reads are safe.
const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET)) {
  throw new Error(
    'ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set when NODE_ENV=production'
  );
}

export const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret-change-me';
export const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-me';
