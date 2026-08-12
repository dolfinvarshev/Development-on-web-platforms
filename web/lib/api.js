export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Thin JSON fetch wrapper for the Express API.
 * Throws Error with .status and .data on non-2xx responses.
 */
export async function apiFetch(path, { method = 'GET', body, headers = {}, ...rest } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---- Admin auth (access token in memory, refresh token in httpOnly cookie) ----

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

export async function refreshAccessToken() {
  const data = await apiFetch('/api/auth/refresh', { method: 'POST' });
  accessToken = data.accessToken;
  return accessToken;
}

/**
 * Authenticated fetch for the admin panel.
 * Gets an access token via the refresh cookie when missing, retries once on 401.
 * Throws (status 401) when there is no valid session — caller shows the login form.
 */
export async function adminFetch(path, options = {}) {
  const call = (token) =>
    apiFetch(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });

  if (!accessToken) await refreshAccessToken();
  try {
    return await call(accessToken);
  } catch (err) {
    if (err.status === 401) {
      await refreshAccessToken();
      return call(accessToken);
    }
    throw err;
  }
}

/**
 * Fetches a CMS content page (server components — always fresh so admin edits
 * show up immediately). Returns the page object or null when unavailable.
 */
export async function fetchContent(key) {
  try {
    const data = await apiFetch(`/api/content/${key}`, { cache: 'no-store' });
    return data.page || null;
  } catch {
    return null;
  }
}
