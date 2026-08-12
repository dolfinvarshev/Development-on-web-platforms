// [B1] Bearer access-token guard for admin-only routes (docs/ARCHITECTURE.md §6).
import jwt from 'jsonwebtoken';

// dotenv is loaded as the very first import of the server entry point (src/index.js),
// so reading the env at module scope is safe.
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret-change-me';

/**
 * Verifies the "Authorization: Bearer <access token>" header.
 * On success attaches req.admin = { username } and continues; any failure
 * (missing header, malformed scheme, invalid/expired token) is a uniform 401
 * so callers learn nothing about why authentication failed.
 */
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.admin = { username: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
