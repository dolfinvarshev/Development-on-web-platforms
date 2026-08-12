'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAdminApi } from './useAdminApi';
import Loading from './Loading';

const FIELDS = [
  {
    name: 'radiusM',
    label: 'רדיוס הזנקה (מטרים)',
    hint: 'דרישה 10: הרדיוס שקובע אילו מתנדבים מוזנקים בסימולטור (100–20,000)',
    min: 100,
    max: 20000,
  },
  {
    name: 'scatterFactor',
    label: 'מקדם פיזור',
    hint: 'המכשירים מפוזרים בתוך רדיוס × מקדם (1–10)',
    min: 1,
    max: 10,
    step: 0.5,
  },
  {
    name: 'freshTelemetryMinutes',
    label: 'חלון שידור "טרי" (דקות)',
    hint: 'מכשיר ששידר בתוך חלון זה מדורג לפני מכשירים "ישנים" (1–120)',
    min: 1,
    max: 120,
  },
];

/** Simulator configuration (requirement 10 — the radius parameter lives here). */
export default function SimConfigTab() {
  const api = useAdminApi();
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/config')
      .then((data) => {
        if (cancelled) return;
        const { config } = data;
        setDraft({
          radiusM: config.radiusM,
          scatterFactor: config.scatterFactor,
          freshTelemetryMinutes: config.freshTelemetryMinutes,
          lat: config.defaultCenter.lat,
          lng: config.defaultCenter.lng,
        });
      })
      .catch(() => {
        if (!cancelled) setError('טעינת ההגדרות נכשלה — ודאו שהשרת פועל');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setNum = (name) => (e) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [name]: e.target.value }));
  };

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const numeric = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, Number(v)])
    );
    if (Object.values(numeric).some((v) => !Number.isFinite(v))) {
      setError('כל השדות חייבים להכיל מספרים תקינים');
      setSaving(false);
      return;
    }

    try {
      const data = await api('/api/config', {
        method: 'PUT',
        body: {
          radiusM: numeric.radiusM,
          scatterFactor: numeric.scatterFactor,
          freshTelemetryMinutes: numeric.freshTelemetryMinutes,
          defaultCenter: { lat: numeric.lat, lng: numeric.lng },
        },
      });
      const { config } = data;
      setDraft({
        radiusM: config.radiusM,
        scatterFactor: config.scatterFactor,
        freshTelemetryMinutes: config.freshTelemetryMinutes,
        lat: config.defaultCenter.lat,
        lng: config.defaultCenter.lng,
      });
      setSaved(true);
    } catch (err) {
      if (err.status !== 401) {
        setError(err.data?.message || 'השמירה נכשלה — בדקו את הערכים');
      }
    } finally {
      setSaving(false);
    }
  }

  if (error && draft === null) return <Alert tone="danger">{error}</Alert>;
  if (draft === null) return <Loading text="טוענים את הגדרות הסימולטור…" />;

  return (
    <Card className="max-w-2xl">
      <h3 className="text-lg font-bold text-slate-900">הגדרות הסימולטור</h3>
      <p className="mt-1 text-sm text-slate-500">
        הערכים כאן משמשים כברירת מחדל לכל קריאת מצוקה חדשה בסימולטור.
      </p>

      <form onSubmit={save} className="mt-6 space-y-5">
        {FIELDS.map((f) => (
          <Field key={f.name} label={f.label} hint={f.hint}>
            <Input
              type="number"
              dir="ltr"
              min={f.min}
              max={f.max}
              step={f.step ?? 1}
              value={draft[f.name]}
              onChange={setNum(f.name)}
              required
            />
          </Field>
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מרכז מפה — קו רוחב (lat)">
            <Input type="number" dir="ltr" step="0.0001" value={draft.lat} onChange={setNum('lat')} required />
          </Field>
          <Field label="מרכז מפה — קו אורך (lng)">
            <Input type="number" dir="ltr" step="0.0001" value={draft.lng} onChange={setNum('lng')} required />
          </Field>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        {saved && <Alert tone="success">ההגדרות נשמרו! הסימולטור ישתמש בהן מהקריאה הבאה.</Alert>}

        <Button type="submit" disabled={saving}>
          {saving ? 'שומרים…' : 'שמירת הגדרות'}
        </Button>
      </form>
    </Card>
  );
}
