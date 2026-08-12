// [B1] Admin authentication: login / refresh (with rotation) / logout / me.
// Contract: docs/ARCHITECTURE.md §6 (Auth). Access token lives in memory on the
// client; the refresh token lives in an httpOnly cookie scoped to /api/auth.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/sqlite.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const isProd = process.env.NODE_ENV === 'production';

// Fail hard rather than silently signing tokens with a public, repo-known dev
// secret: a production deploy that forgot to set the env vars would otherwise be
// fully forgeable by anyone who read the GitHub repo. Locally the dev fallbacks
// keep zero-config `npm run dev` working.
if (isProd && (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET)) {
  throw new Error('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set when NODE_ENV=production');
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret-change-me';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-me';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const COOKIE_NAME = 'refresh_token';
// path '/api/auth' keeps the refresh token off every non-auth request.
// Production runs cross-site (web on Vercel, API on Render), which requires
// sameSite 'none' + secure; 'lax' keeps plain-http local development working.
const COOKIE_OPTIONS = {
  httpOnly: true,
  path: '/api/auth',
  sameSite: isProd ? 'none' : 'lax',
  secure: isProd,
};

const router = Router();

function signAccessToken(username) {
  return jwt.sign({ sub: username, role: 'admin' }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}

/** Inserts a refresh_tokens row for a fresh jti and sets the matching cookie. */
function issueRefreshToken(res, username) {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  getDb()
    .prepare('INSERT INTO refresh_tokens (jti, username, expires_at) VALUES (?, ?, ?)')
    .run(jti, username, expiresAt);
  const token = jwt.sign({ sub: username, jti }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: REFRESH_TTL_MS });
}

/**
 * Validates the refresh cookie end to end: JWT signature, a live (non-revoked,
 * non-expired) refresh_tokens row for its jti, and that the row belongs to the
 * user named in the token. Returns { jti, username } or null.
 */
function verifyRefreshCookie(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch {
    return null;
  }
  const row = getDb()
    .prepare('SELECT jti, username, expires_at, revoked FROM refresh_tokens WHERE jti = ?')
    .get(payload.jti);
  if (!row || row.revoked !== 0) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.username !== payload.sub) return null;
  return { jti: row.jti, username: row.username };
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const row =
    typeof username === 'string' && username
      ? getDb().prepare('SELECT username, password_hash FROM admins WHERE username = ?').get(username)
      : null;
  const valid = row && typeof password === 'string' && bcrypt.compareSync(password, row.password_hash);
  if (!valid) {
    // Single message for both unknown user and wrong password — no username enumeration.
    return res
      .status(401)
      .json({ error: 'invalid_credentials', message: 'שם משתמש או סיסמה שגויים' });
  }
  issueRefreshToken(res, row.username);
  res.json({ accessToken: signAccessToken(row.username), admin: { username: row.username } });
});

router.post('/refresh', (req, res) => {
  const session = verifyRefreshCookie(req);
  if (!session) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // Rotation: every refresh token is single-use. A replayed (already revoked)
  // token fails verifyRefreshCookie above, so a stolen cookie dies on first reuse.
  const db = getDb();
  db.transaction(() => {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?').run(session.jti);
    issueRefreshToken(res, session.username);
  })();
  res.json({ accessToken: signAccessToken(session.username) });
});

router.post('/logout', (req, res) => {
  const session = verifyRefreshCookie(req);
  if (session) {
    getDb().prepare('UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?').run(session.jti);
  }
  // clearCookie must repeat the attributes the cookie was set with (path etc.).
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: { username: req.admin.username } });
});

export default router;
