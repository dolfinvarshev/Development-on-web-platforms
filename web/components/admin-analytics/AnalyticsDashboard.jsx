'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, PageHero, Section } from '@/components/ui';
import { adminFetch } from '@/lib/api';
import { formatSeconds } from '@/lib/format';
import { deriveAnalytics } from './analytics-data';
import ResponseTimesChart from './ResponseTimesChart';
import StatusBreakdown from './StatusBreakdown';
import IncidentsTable from './IncidentsTable';

function StatTile({ value, label }) {
  return (
    <Card className="text-center">
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </Card>
  );
}

export default function AnalyticsDashboard() {
  const [status, setStatus] = useState('loading'); // loading | ready | unauthorized | error
  const [incidents, setIncidents] = useState([]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await adminFetch('/api/incidents');
      setIncidents(data.incidents || []);
      setStatus('ready');
    } catch (err) {
      setStatus(err.status === 401 ? 'unauthorized' : 'error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const analytics = useMemo(() => deriveAnalytics(incidents), [incidents]);

  return (
    <>
      <PageHero
        title="אנליטיקת זמני תגובה"
        lead="כמה מהר מתנדבים מאשרים קריאה ומגיעים לזירה — על בסיס כל האירועים שנפתחו במערכת."
      >
        <Link
          href="/admin"
          className="text-sm font-semibold text-slate-500 transition hover:text-emerald-700"
        >
          → חזרה ללוח הבקרה
        </Link>
      </PageHero>

      <Section>
        {status === 'loading' && (
          <Card className="animate-pulse py-12 text-center text-slate-400">טוען נתונים…</Card>
        )}

        {status === 'unauthorized' && (
          <div className="max-w-xl">
            <Alert tone="warning" title="נדרשת התחברות מנהל">
              עמוד האנליטיקה זמין למנהלי המערכת בלבד. יש להתחבר דרך עמוד הניהול ולחזור לכאן.
            </Alert>
            <Button as={Link} href="/admin" className="mt-4">
              לעמוד ההתחברות
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="max-w-xl">
            <Alert tone="danger" title="שגיאה בטעינת הנתונים">
              לא הצלחנו לטעון את רשימת האירועים מהשרת. בדקו שהשרת פועל ונסו שוב.
            </Alert>
            <Button variant="outline" className="mt-4" onClick={load}>
              נסו שוב
            </Button>
          </div>
        )}

        {status === 'ready' && incidents.length === 0 && (
          <Card className="py-14 text-center">
            <p className="text-lg font-semibold text-slate-700">
              עדיין אין אירועים — הריצו את הסימולטור כדי לראות אנליטיקה
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              כל אירוע מצוקה שנפתח בסימולטור נרשם כאן אוטומטית, כולל זמן האישור וזמן ההגעה של המתנדב.
            </p>
            <Button as={Link} href="/simulator" className="mt-6">
              לפתיחת הסימולטור
            </Button>
          </Card>
        )}

        {status === 'ready' && incidents.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile value={analytics.totalCount} label="סה״כ אירועים" />
              <StatTile value={analytics.resolvedCount} label="אירועים שטופלו" />
              <StatTile value={formatSeconds(analytics.avgResponseSeconds)} label="זמן תגובה ממוצע" />
              <StatTile value={formatSeconds(analytics.medianAcceptSeconds)} label="זמן אישור חציוני" />
            </div>

            <Card>
              <h2 className="text-lg font-bold text-slate-900">זמני תגובה — אירועים אחרונים</h2>
              <p className="mt-1 text-sm text-slate-500">
                עד 20 האירועים האחרונים שטופלו, מפוצלים לזמן עד אישור המתנדב ולזמן הנסיעה עד ההגעה.
              </p>
              <div className="mt-5">
                {analytics.recentResolved.length > 0 ? (
                  <ResponseTimesChart incidents={analytics.recentResolved} />
                ) : (
                  <p className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">
                    אין עדיין אירועים שטופלו עד הסוף — התרשים יופיע לאחר שמתנדב ידווח על הגעה.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-slate-900">סטטוס אירועים</h2>
              <p className="mt-1 text-sm text-slate-500">התפלגות כלל האירועים לפי מצבם הנוכחי.</p>
              <div className="mt-5">
                <StatusBreakdown statusCounts={analytics.statusCounts} />
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-slate-900">כל האירועים</h2>
              <p className="mt-1 text-sm text-slate-500">
                אותם נתונים כמו בתרשימים, בטבלה מלאה — נגישה גם ללא עכבר וללא ראיית צבע.
              </p>
              <div className="mt-4">
                <IncidentsTable incidents={incidents} />
              </div>
            </Card>
          </div>
        )}
      </Section>
    </>
  );
}
