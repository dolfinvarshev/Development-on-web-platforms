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
