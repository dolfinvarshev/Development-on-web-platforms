'use client';

/**
 * [F4] Call-center (101) live view of one incident. Receives the incident from
 * the server component and keeps polling every 4 seconds while it is still
 * active/responding, redrawing the breadcrumb trail and the volunteer position.
 */

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Alert, Badge, Card } from '@/components/ui';
import OfficialChannels from '@/components/OfficialChannels';
import { formatDateTimeHe, formatDistanceM, formatSeconds, relativeTimeHe } from '@/lib/format';
import { devicePopupHtml, incidentIcon, rankIcon, volunteerIcon } from './leaflet-utils';

const POLL_MS = 4000;

const STATUS_META = {
  active: { color: 'amber', label: 'פעיל' },
  responding: { color: 'sky', label: 'מתנדב בדרך' },
  resolved: { color: 'emerald', label: 'טופל' },
  cancelled: { color: 'slate', label: 'בוטל' },
};

function TimelineRow({ done, title, value, sub }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full ${
          done ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500" suppressHydrationWarning>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs font-bold text-emerald-700">{sub}</p>}
      </div>
    </li>
  );
}

export default function IncidentView({ initial }) {
  const [incident, setIncident] = useState(initial);

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const trailRef = useRef(null);
  const volunteerRef = useRef(null);
  const incidentRef = useRef(initial);

  // Redraws only the moving parts (trail + volunteer) — static layers are
  // created once at map bootstrap.
  function syncTrail() {
    const L = leafletRef.current;
    const map = mapRef.current;
    const inc = incidentRef.current;
    if (!L || !map || !inc) return;

    const crumbs = (inc.breadcrumbs || []).map((b) => [b.lat, b.lng]);
    if (crumbs.length > 0) {
      if (trailRef.current) {
        trailRef.current.setLatLngs(crumbs);
      } else {
        trailRef.current = L.polyline(crumbs, {
          color: '#dc2626',
          weight: 3,
          dashArray: '6 8',
          opacity: 0.9,
        }).addTo(map);
      }
    }

    // Volunteer at the last reported position; before the first breadcrumb,
    // at the accepting candidate's start position.
    let pos = crumbs.length > 0 ? crumbs[crumbs.length - 1] : null;
    if (!pos && inc.responder?.deviceId != null) {
      const start = (inc.candidates || []).find((c) => c.deviceId === inc.responder.deviceId);
      if (start) pos = [start.lat, start.lng];
    }
    if (pos) {
      if (volunteerRef.current) {
        volunteerRef.current.setLatLng(pos);
      } else {
        volunteerRef.current = L.marker(pos, { icon: volunteerIcon(L), zIndexOffset: 2000 }).addTo(
          map
        );
      }
    }
  }

  // Map bootstrap — client only, once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapDivRef.current || mapRef.current) return;
      leafletRef.current = L;
      const inc = incidentRef.current;
      const map = L.map(mapDivRef.current).setView([inc.location.lat, inc.location.lng], 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const circle = L.circle([inc.location.lat, inc.location.lng], {
        radius: inc.radiusM,
        color: '#dc2626',
        weight: 2,
        fillColor: '#dc2626',
        fillOpacity: 0.08,
      }).addTo(map);
      L.marker([inc.location.lat, inc.location.lng], { icon: incidentIcon(L), zIndexOffset: 1000 })
        .bindPopup('<div dir="rtl" style="font-weight:700">נקודת האירוע</div>')
        .addTo(map);
      for (const c of inc.candidates || []) {
        if (!c.inRadius) continue;
        L.marker([c.lat, c.lng], { icon: rankIcon(L, c.rank) })
          .bindPopup(devicePopupHtml(c))
          .addTo(map);
      }
      map.fitBounds(circle.getBounds().pad(0.15));
      mapRef.current = map;
      syncTrail();
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      trailRef.current = null;
      volunteerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the moving layers in sync with every incident update.
  useEffect(() => {
    incidentRef.current = incident;
    syncTrail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident]);

  // Live polling while the incident is still open; stops once resolved/cancelled.
  useEffect(() => {
    if (incident.status !== 'active' && incident.status !== 'responding') return undefined;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const data = await apiFetch(`/api/incidents/${incident.id}`, { cache: 'no-store' });
        if (!cancelled && data.incident) setIncident(data.incident);
      } catch {
        // Transient network error — keep the current snapshot and retry.
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [incident.status, incident.id]);

  const meta = STATUS_META[incident.status] || STATUS_META.active;
  const responder = incident.responder?.deviceId != null ? incident.responder : null;
  const crumbs = incident.breadcrumbs || [];
  const lastCrumb = crumbs.length > 0 ? crumbs[crumbs.length - 1] : null;
  const candidates = incident.candidates || [];
  const inRadiusCount = candidates.filter((c) => c.inRadius).length;
  const createdMs = new Date(incident.createdAt).getTime();
  const acceptSeconds = responder?.acceptedAt
    ? Math.round((new Date(responder.acceptedAt).getTime() - createdMs) / 1000)
    : null;
  const responseSeconds = incident.arrivedAt
    ? Math.round((new Date(incident.arrivedAt).getTime() - createdMs) / 1000)
    : null;
  const live = incident.status === 'active' || incident.status === 'responding';

  return (
    <>
      {/* Dispatch-console header */}
      <div className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              )}
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">תצוגת מוקד 101</h1>
              <p className="text-xs text-slate-400" suppressHydrationWarning>
                אירוע #{incident.id.slice(-6)} · נפתח {formatDateTimeHe(incident.createdAt)}
              </p>
            </div>
          </div>
          <Badge color={meta.color} className="text-sm">
            {meta.label}
          </Badge>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div
            ref={mapDivRef}
            className="relative z-0 h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 lg:h-[560px]"
            aria-label="מפת האירוע"
          />

          <div className="space-y-4">
            <OfficialChannels />

            <Card>
              <p className="text-xs font-semibold text-slate-500">מרחק שנותר עד המטופל</p>
              <p
                className={`mt-1 text-3xl font-extrabold ${
                  incident.status === 'resolved' ? 'text-emerald-700' : 'text-slate-900'
                }`}
              >
                {incident.status === 'resolved'
                  ? 'הגיע ליעד ✓'
                  : lastCrumb
                    ? formatDistanceM(lastCrumb.distanceRemainingM)
                    : '—'}
              </p>
              {lastCrumb && incident.status === 'responding' && (
                <p className="mt-1 text-xs text-slate-400" suppressHydrationWarning>
                  דיווח אחרון: {relativeTimeHe(lastCrumb.at)}
                </p>
              )}
            </Card>

            <Card>
              <h2 className="text-base font-bold text-slate-900">מתנדב מוזנק</h2>
              {responder ? (
                <div className="mt-2">
                  <p className="font-bold text-slate-900">{responder.label}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    טלפון:{' '}
                    <span dir="ltr" className="font-semibold text-slate-800">
                      {responder.phone}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    המספר מוצג ממוסך — המספר המלא זמין למוקדן מורשה בלבד
                  </p>
                  <p className="mt-1 text-xs text-slate-500" suppressHydrationWarning>
                    אישר הגעה: {formatDateTimeHe(responder.acceptedAt)}
                  </p>
                </div>
              ) : (
                <Alert tone="info" className="mt-3">
                  טרם אושרה הגעה על ידי מתנדב — ההתראות נשלחו לכל המועמדים בתחום.
                </Alert>
              )}
            </Card>

            <Card>
              <h2 className="text-base font-bold text-slate-900">ציר זמן</h2>
              <ol className="mt-4 space-y-4">
                <TimelineRow
                  done
                  title="נפתחה קריאת מצוקה"
                  value={formatDateTimeHe(incident.createdAt)}
                />
                <TimelineRow
                  done={!!responder}
                  title="מתנדב אישר הגעה"
                  value={
                    responder
                      ? `${formatDateTimeHe(responder.acceptedAt)} · ${formatSeconds(acceptSeconds)} מפתיחת האירוע`
                      : 'ממתין לאישור…'
                  }
                />
                <TimelineRow
                  done={!!incident.arrivedAt}
                  title="הגעה אל המטופל"
                  value={incident.arrivedAt ? formatDateTimeHe(incident.arrivedAt) : 'בהמתנה'}
                  sub={incident.arrivedAt ? `זמן תגובה: ${formatSeconds(responseSeconds)}` : null}
                />
              </ol>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">נתוני האירוע</h2>
                {live && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    עדכון חי
                  </span>
                )}
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">רדיוס הזנקה</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatDistanceM(incident.radiusM)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">מועמדים בתחום</dt>
                  <dd className="font-semibold text-slate-800">
                    {inRadiusCount} מתוך {candidates.length}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">דיווחי מיקום שהתקבלו</dt>
                  <dd className="font-semibold text-slate-800">{crumbs.length}</dd>
                </div>
              </dl>
              {live && (
                <p className="mt-3 text-xs text-slate-400">
                  התצוגה מתעדכנת אוטומטית כל 4 שניות
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
