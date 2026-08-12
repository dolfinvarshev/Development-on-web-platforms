'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import { adminFetch, apiFetch, clearAccessToken, refreshAccessToken } from '@/lib/api';
import { AdminApiContext } from './useAdminApi';
import Loading from './Loading';
import LoginForm from './LoginForm';
import DashboardTab from './DashboardTab';
import ContentEditorTab from './ContentEditorTab';
import VolunteersTab from './VolunteersTab';
import AlertsTab from './AlertsTab';
import SimConfigTab from './SimConfigTab';

const TABS = [
  { id: 'dashboard', label: 'דשבורד' },
  { id: 'content', label: 'ניהול תוכן' },
  { id: 'volunteers', label: 'מתנדבים ומכשירים' },
  { id: 'alerts', label: 'התראות' },
  { id: 'config', label: 'הגדרות סימולטור' },
];

/**
 * Admin panel state machine: loading → (login | authed).
 * On mount we try a silent refresh (httpOnly cookie); if it succeeds the login
 * screen is skipped entirely. Every admin call in the panel goes through `api`,
 * which funnels a final 401 back to the login screen exactly once.
 */
export default function AdminApp() {
  const [phase, setPhase] = useState('loading');
  const [username, setUsername] = useState(null);
  const [loginNotice, setLoginNotice] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshAccessToken();
        const data = await adminFetch('/api/auth/me');
        if (!cancelled) {
          setUsername(data.admin.username);
          setPhase('authed');
        }
      } catch {
        if (!cancelled) setPhase('login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const expireSession = useCallback(() => {
    clearAccessToken();
    setUsername(null);
    setTab('dashboard');
    setLoginNotice('פג תוקף החיבור — התחברו שוב');
    setPhase('login');
  }, []);

  // adminFetch already retries once with a fresh token; a 401 that still escapes it
  // means the refresh cookie itself is dead, so the only sane move is re-login.
  const api = useCallback(
    async (path, options) => {
      try {
        return await adminFetch(path, options);
      } catch (err) {
        if (err.status === 401) expireSession();
        throw err;
      }
    },
    [expireSession]
  );

  function handleLoggedIn(name) {
    setUsername(name);
    setLoginNotice(null);
    setTab('dashboard');
    setLoggingOut(false);
    setPhase('authed');
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // The cookie may already be expired server-side — logging out locally is enough.
    }
    clearAccessToken();
    setUsername(null);
    setLoginNotice(null);
    setTab('dashboard');
    setLoggingOut(false);
    setPhase('login');
  }

  if (phase === 'loading') {
    return (
      <div className="py-24">
        <Loading text="בודקים אם יש חיבור פעיל…" />
      </div>
    );
  }

  if (phase === 'login') {
    return (
      <div className="bg-slate-50 px-4 py-16">
        <LoginForm notice={loginNotice} onLoggedIn={handleLoggedIn} />
      </div>
    );
  }

  return (
    <div className="bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 pb-2 pt-6">
          <div className="me-auto">
            <h1 className="text-2xl font-extrabold text-slate-900">לוח הבקרה של דפי-נט</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              ניהול תוכן, מתנדבים, התראות והסימולטור — במקום אחד
            </p>
          </div>
          <Badge color="emerald">מחוברים כ־{username}</Badge>
          <Button variant="outline" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'מתנתקים…' : 'התנתקות'}
          </Button>
        </div>
        <nav className="mx-auto max-w-6xl px-4" aria-label="לשוניות ניהול">
          <div className="flex flex-wrap gap-1 overflow-x-auto pt-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                  tab === t.id
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
            <Link
              href="/admin/analytics"
              className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            >
              אנליטיקת תגובה ↗
            </Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <AdminApiContext.Provider value={api}>
          {tab === 'dashboard' && <DashboardTab onNavigate={setTab} />}
          {tab === 'content' && <ContentEditorTab />}
          {tab === 'volunteers' && <VolunteersTab />}
          {tab === 'alerts' && <AlertsTab />}
          {tab === 'config' && <SimConfigTab />}
        </AdminApiContext.Provider>
      </div>
    </div>
  );
}
