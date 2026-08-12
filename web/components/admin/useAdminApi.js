'use client';

import { createContext, useContext } from 'react';

/**
 * Shared admin API channel. AdminApp provides an `api(path, options)` function that
 * wraps adminFetch and, on a final 401 (refresh token expired/revoked), kicks the
 * whole panel back to the login screen. Tab components therefore only need to handle
 * "real" errors: they check `err.status !== 401` and otherwise stay silent, because
 * the shell has already navigated away.
 */
export const AdminApiContext = createContext(null);

export function useAdminApi() {
  const api = useContext(AdminApiContext);
  if (!api) {
    throw new Error('useAdminApi חייב לרוץ בתוך AdminApp');
  }
  return api;
}
