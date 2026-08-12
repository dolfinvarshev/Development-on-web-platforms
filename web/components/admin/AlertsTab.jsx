'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import { useAdminApi } from './useAdminApi';
import AlertList from './AlertList';
import Loading from './Loading';

/** The full alert log: maintenance (battery < 20%) + hybrid dispatch alerts. */
export default function AlertsTab() {
  const api = useAdminApi();
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const data = await api('/api/alerts?limit=100');
      setAlerts(data.alerts);
    } catch (err) {
      if (err.status !== 401) setError('טעינת ההתראות נכשלה — נסו לרענן');
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Alert tone="info">
        התראות תחזוקה נוצרות אוטומטית כשסוללת משדר יורדת מתחת ל-20% (דרישת «עדכון שקט»), והתראות
        הזנקה נרשמות בכל קריאת מצוקה — ערוץ ה-Push הסלולרי ופקודות ה-Downlink של LoRa.
      </Alert>

      {error && <Alert tone="danger">{error}</Alert>}

      {alerts === null ? (
        <Loading text="טוענים את יומן ההתראות…" />
      ) : (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="font-bold text-slate-900">יומן ההתראות ({alerts.length})</h3>
            <Button variant="outline" onClick={load} disabled={refreshing}>
              {refreshing ? 'מרעננים…' : 'רענון'}
            </Button>
          </div>
          <div className="px-6 py-2">
            <AlertList alerts={alerts} />
          </div>
        </Card>
      )}
    </div>
  );
}
