'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAdminApi } from './useAdminApi';
import AlertList from './AlertList';
import Loading from './Loading';

const STAT_TILES = [
  { key: 'volunteers', label: 'מתנדבים רשומים' },
  { key: 'devices', label: 'מכשירים במערך' },
  { key: 'withLora', label: 'עם יחידת LoRa' },
  { key: 'withMagnus', label: 'עם לוויין MAGNUS' },
  { key: 'mobile', label: 'מכשירים ניידים' },
  { key: 'stationary', label: 'מכשירים נייחים' },
  { key: 'repeaters', label: 'מגברי רשת' },
];

const QUICK_ACTIONS = [
  {
    emoji: '📝',
    title: 'עריכת תוכן שיווקי',
    description: 'עדכון כותרות, פסקאות וקישורים בכל עמודי האתר — בלי לגעת בקוד',
    tab: 'content',
    cta: 'לעריכת תוכן',
  },
  {
    emoji: '🧑‍🤝‍🧑',
    title: 'ניהול מתנדבים',
    description: 'חיפוש, עריכה ומחיקה של נרשמים והמכשירים שלהם במאגר',
    tab: 'volunteers',
    cta: 'למתנדבים',
  },
  {
    emoji: '🗺️',
    title: 'סימולטור הזנקה',
    description: 'הדגמה חיה של אירוע חירום — פיזור מכשירים, רדיוס והזנקות',
    href: '/simulator',
    cta: 'לסימולטור',
  },
];

export default function DashboardTab({ onNavigate }) {
  const api = useAdminApi();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ticking, setTicking] = useState(false);
  const [tickResult, setTickResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, alertsData] = await Promise.all([
        apiFetch('/api/stats'),
        api('/api/alerts?limit=8'),
      ]);
      setStats(statsData);
      setAlerts(alertsData.alerts);
    } catch (err) {
      if (err.status !== 401) setError('טעינת הנתונים נכשלה — ודאו שהשרת פועל ונסו שוב');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  // Runs one "silent update" cycle: every LoRa/MAGNUS device reports fresh
  // telemetry and drains a little battery — the mechanism behind the automatic
  // <20% maintenance alert. Exposed here so the whole flow is demonstrable from
  // the browser, then refreshes the dashboard to surface any new alert.
  const runSilentUpdate = useCallback(async () => {
    setTicking(true);
    setTickResult(null);
    try {
      const res = await apiFetch('/api/telemetry/tick', { method: 'POST' });
      setTickResult(res);
      await load();
    } catch {
      setTickResult({ error: true });
    } finally {
      setTicking(false);
    }
  }, [load]);

  if (loading) return <Loading text="טוענים את הדשבורד…" />;

  if (error) {
    return (
      <Alert tone="danger" className="flex flex-wrap items-center justify-between gap-3">
        <span>{error}</span>
        <Button variant="outline" onClick={load}>
          נסו שוב
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-label="נתוני המערך">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STAT_TILES.map((tile) => (
            <Card key={tile.key} className="p-4">
              <p className="text-3xl font-extrabold text-emerald-700" dir="ltr">
                {stats[tile.key]}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500">{tile.label}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="פעולות מהירות">
        <h2 className="text-lg font-bold text-slate-900">פעולות מהירות</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Card key={action.title} className="flex flex-col">
              <span className="text-2xl" aria-hidden="true">
                {action.emoji}
              </span>
              <h3 className="mt-2 font-bold text-slate-900">{action.title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">
                {action.description}
              </p>
              {action.href ? (
                <Button as={Link} href={action.href} variant="outline" className="mt-4 self-start">
                  {action.cta}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="mt-4 self-start"
                  onClick={() => onNavigate(action.tab)}
                >
                  {action.cta}
                </Button>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="מחזור עדכון שקט">
        <Card className="flex flex-col gap-3 border-emerald-200 bg-emerald-50/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">מחזור עדכון שקט (Silent Update)</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              הרצת מחזור טלמטריה: כל משדר LoRa/MAGNUS מדווח מיקום וסוללה, והמערכת שולחת התראת תחזוקה
              אוטומטית לכל מכשיר שירד מתחת ל-20%.
            </p>
          </div>
          <Button onClick={runSilentUpdate} disabled={ticking} className="shrink-0">
            {ticking ? 'מריצים…' : 'הרצת מחזור עכשיו'}
          </Button>
        </Card>
        {tickResult && (
          <div className="mt-3">
            {tickResult.error ? (
              <Alert tone="danger">הרצת המחזור נכשלה — נסו שוב.</Alert>
            ) : tickResult.alerts?.length > 0 ? (
              <Alert tone="warning" title={`עודכנו ${tickResult.updated} מכשירים · ${tickResult.alerts.length} התראות תחזוקה חדשות`}>
                <ul className="mt-1 list-disc space-y-1 pe-5">
                  {tickResult.alerts.map((a) => (
                    <li key={a.id}>{a.message}</li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <Alert tone="success">
                עודכנו {tickResult.updated} מכשירים. אף מכשיר לא חצה את סף ה-20% במחזור זה — הריצו שוב
                כדי להמשיך לרוקן סוללות ולראות התראת תחזוקה.
              </Alert>
            )}
          </div>
        )}
      </section>

      <section aria-label="התראות אחרונות">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">התראות אחרונות</h2>
            <Button variant="ghost" onClick={() => onNavigate('alerts')}>
              לכל ההתראות
            </Button>
          </div>
          <div className="mt-2">
            <AlertList alerts={alerts} />
          </div>
        </Card>
      </section>
    </div>
  );
}
