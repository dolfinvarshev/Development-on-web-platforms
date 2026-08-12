'use client';

/**
 * [F4] The distress-call simulator — the project's centerpiece demo.
 * Full end-to-end chain in the browser: pick a point → POST /api/incidents
 * (the server scatters the fleet, geo-fences, ranks and fires the hybrid
 * cellular+LoRa alerts) → volunteer accepts → real OSRM bike route → animated
 * ride with live breadcrumb reports to the call center → arrival + response time.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDistanceM, formatSeconds, relativeTimeHe, sourceLabel } from '@/lib/format';
import { beep, sosBeep } from '@/lib/sound';
import { Alert, Badge, Button, Card, Field, Input, PageHero } from '@/components/ui';
import OfficialChannels from '@/components/OfficialChannels';
import {
  cumulativeDistances,
  devicePopupHtml,
  dotIcon,
  haversineM,
  incidentIcon,
  pickIcon,
  pointAlong,
  rankIcon,
  volunteerIcon,
} from './leaflet-utils';

const FALLBACK_CENTER = { lat: 32.0809, lng: 34.7806 };
// Matches the server-side PUT /api/config bounds, so an admin-configured radius
// is always honored by the simulator instead of being silently clamped.
const RADIUS_MIN = 100;
const RADIUS_MAX = 20000;
const BIKE_SPEED_MS = 5.5; // realistic urban bike speed
const SIM_SPEED_FACTOR = 5; // demo runs x5 → ~27.5 m/s so a ride takes seconds
const TICK_MS = 100;
const BREADCRUMB_EVERY_MS = 2000;
const ROUTING_TIMEOUT_MS = 8000;

const SOURCE_BADGE = { lora: 'emerald', magnus: 'violet', phone: 'sky' };

const clampRadius = (value) =>
  Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(Number(value) || 0)));

function SoundToggle({ on, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <span>{on ? '🔊' : '🔇'} צליל התראה (LoRa Downlink)</span>
      <span
        className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
          on ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-300'
        }`}
      >
        <span className="h-4 w-4 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

export default function SimulatorApp() {
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [radius, setRadius] = useState(1500);
  const [soundOn, setSoundOn] = useState(true);
  const [point, setPoint] = useState(null);
  // idle → ready → dispatching → alerted → routing → enroute → arrived
  const [phase, setPhase] = useState('idle');
  const [incident, setIncident] = useState(null);
  const [responder, setResponder] = useState(null);
  const [route, setRoute] = useState(null); // { distanceM, durationS, fallback }
  const [remainingM, setRemainingM] = useState(null);
  const [responseSeconds, setResponseSeconds] = useState(null);
  const [error, setError] = useState(null);
  const [showDevices, setShowDevices] = useState(false);

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const pickMarkerRef = useRef(null);
  const incidentLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const volunteerRef = useRef(null);
  const candidateMarkersRef = useRef(new Map());
  const animTimerRef = useRef(null);
  const phaseRef = useRef('idle');
  const soundRef = useRef(true);
  const aliveRef = useRef(true);

  const changePhase = (next) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const toggleSound = () => {
    setSoundOn((on) => {
      soundRef.current = !on;
      return !on;
    });
  };

  const placePickMarker = (lat, lng) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    setPoint({ lat, lng });
    changePhase('ready');
    if (pickMarkerRef.current) {
      pickMarkerRef.current.setLatLng([lat, lng]);
      return;
    }
    const marker = L.marker([lat, lng], { icon: pickIcon(L), draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setPoint({ lat: pos.lat, lng: pos.lng });
    });
    pickMarkerRef.current = marker;
  };

  const handleMapClick = (latlng) => {
    // The incident point is only editable before the call goes out.
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'ready') return;
    placePickMarker(latlng.lat, latlng.lng);
  };

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    (async () => {
      let center = FALLBACK_CENTER;
      try {
        const data = await apiFetch('/api/config');
        if (cancelled) return;
        setConfig(data.config);
        setRadius(data.config.radiusM);
        center = data.config.defaultCenter || FALLBACK_CENTER;
      } catch {
        // API offline — keep sensible defaults so the map still renders.
      }
      apiFetch('/api/stats')
        .then((s) => {
          if (!cancelled) setStats(s);
        })
        .catch(() => {});

      const L = (await import('leaflet')).default;
      if (cancelled || !mapDivRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapDivRef.current).setView([center.lat, center.lng], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      map.on('click', (e) => handleMapClick(e.latlng));
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      aliveRef.current = false;
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      animTimerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawIncident = (inc) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (pickMarkerRef.current) {
      pickMarkerRef.current.remove();
      pickMarkerRef.current = null;
    }
    if (incidentLayerRef.current) incidentLayerRef.current.remove();
    const group = L.layerGroup().addTo(map);
    incidentLayerRef.current = group;
    candidateMarkersRef.current = new Map();

    const circle = L.circle([inc.location.lat, inc.location.lng], {
      radius: inc.radiusM,
      color: '#dc2626',
      weight: 2,
      fillColor: '#dc2626',
      fillOpacity: 0.08,
    }).addTo(group);

    L.marker([inc.location.lat, inc.location.lng], { icon: incidentIcon(L), zIndexOffset: 1000 })
      .bindPopup('<div dir="rtl" style="font-weight:700">נקודת האירוע — דיווח על דום לב</div>')
      .addTo(group);

    for (const c of inc.candidates) {
      const icon = c.inRadius ? rankIcon(L, c.rank) : dotIcon(L, '#94a3b8', 10);
      const marker = L.marker([c.lat, c.lng], { icon, zIndexOffset: c.inRadius ? 500 : 0 })
        .bindPopup(devicePopupHtml(c))
        .addTo(group);
      candidateMarkersRef.current.set(c.deviceId, marker);
    }

    for (const node of inc.meshNodes || []) {
      L.marker([node.lat, node.lng], { icon: dotIcon(L, '#8b5cf6', 8) })
        .bindPopup(
          devicePopupHtml({
            label: node.label,
            locationSource: 'lora',
            lastSeen: node.lastSeen,
            battery: null,
            distanceM: haversineM(inc.location.lat, inc.location.lng, node.lat, node.lng),
          })
        )
        .addTo(group);
    }

    map.fitBounds(circle.getBounds().pad(0.2));
  };

  const dispatchIncident = async () => {
    if (!point || phaseRef.current !== 'ready') return;
    const radiusM = clampRadius(radius);
    setRadius(radiusM);
    setError(null);
    changePhase('dispatching');
    try {
      const data = await apiFetch('/api/incidents', {
        method: 'POST',
        body: { lat: point.lat, lng: point.lng, radiusM },
      });
      if (!aliveRef.current) return;
      setIncident(data.incident);
      drawIncident(data.incident);
      changePhase('alerted');
      if (soundRef.current) sosBeep();
    } catch {
      if (!aliveRef.current) return;
      setError('שליחת קריאת המצוקה נכשלה — ודאו ששרת ה-API פועל ונסו שוב.');
      changePhase('ready');
    }
  };

  const focusCandidate = (candidate) => {
    const map = mapRef.current;
    const marker = candidateMarkersRef.current.get(candidate.deviceId);
    if (!map || !marker) return;
    map.panTo([candidate.lat, candidate.lng]);
    marker.openPopup();
  };

  const drawRoute = (coords, fallback) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (routeLayerRef.current) routeLayerRef.current.remove();
    const line = L.polyline(
      coords,
      fallback
        ? { color: '#059669', weight: 4, dashArray: '10 10', opacity: 0.7 }
        : { color: '#059669', weight: 4, opacity: 0.9 }
    );
    routeLayerRef.current = L.layerGroup([line]).addTo(map);
    map.fitBounds(line.getBounds().pad(0.15));
  };

  const finishRide = async (incidentId) => {
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    animTimerRef.current = null;
    try {
      const data = await apiFetch(`/api/incidents/${incidentId}/arrived`, { method: 'POST' });
      if (!aliveRef.current) return;
      setResponseSeconds(data.responseSeconds);
      setIncident(data.incident);
    } catch {
      if (!aliveRef.current) return;
      setResponseSeconds(null);
    }
    if (!aliveRef.current) return;
    setRemainingM(0);
    changePhase('arrived');
    if (soundRef.current) {
      beep({ freq: 880, duration: 0.12 });
      beep({ freq: 1320, when: 0.15, duration: 0.25 });
    }
  };

  const startRide = (coords, incidentId) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const { total, cumulative } = cumulativeDistances(coords);
    const marker = L.marker(coords[0], { icon: volunteerIcon(L), zIndexOffset: 2000 }).addTo(map);
    volunteerRef.current = marker;
    changePhase('enroute');
    setRemainingM(total);

    const speed = BIKE_SPEED_MS * SIM_SPEED_FACTOR;
    let travelled = 0;
    let sinceCrumb = 0;
    let ticks = 0;
    animTimerRef.current = setInterval(() => {
      travelled += speed * (TICK_MS / 1000);
      sinceCrumb += TICK_MS;
      ticks += 1;
      const done = travelled >= total;
      const pos = done ? coords[coords.length - 1] : pointAlong(coords, cumulative, travelled);
      marker.setLatLng(pos);
      const remaining = Math.max(0, total - travelled);
      if (done || ticks % 3 === 0) setRemainingM(remaining);
      if (done || sinceCrumb >= BREADCRUMB_EVERY_MS) {
        sinceCrumb = 0;
        // Fire-and-forget position report — this is what the call center polls.
        apiFetch(`/api/incidents/${incidentId}/breadcrumb`, {
          method: 'POST',
          body: { lat: pos[0], lng: pos[1], distanceRemainingM: Math.round(remaining) },
        }).catch(() => {});
      }
      if (done) finishRide(incidentId);
    }, TICK_MS);
  };

  const acceptCandidate = async (candidate) => {
    if (phaseRef.current !== 'alerted' || !incident) return;
    setError(null);
    setResponder(candidate);
    changePhase('routing');
    try {
      await apiFetch(`/api/incidents/${incident.id}/accept`, {
        method: 'POST',
        body: { deviceId: candidate.deviceId },
      });
    } catch (err) {
      if (!aliveRef.current) return;
      setResponder(null);
      setError(err?.data?.message || 'אישור ההגעה נכשל — נסו שוב.');
      changePhase('alerted');
      return;
    }
    if (!aliveRef.current) return;

    // Requirement 10: a real bike route (OSRM), not an aerial line.
    const target = incident.location;
    let coords;
    let info;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);
    try {
      const url =
        'https://routing.openstreetmap.de/routed-bike/route/v1/bike/' +
        `${candidate.lng},${candidate.lat};${target.lng},${target.lat}` +
        '?overview=full&geometries=geojson';
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('routing_failed');
      const data = await res.json();
      const best = data.routes?.[0];
      if (!best?.geometry?.coordinates || best.geometry.coordinates.length < 2) {
        throw new Error('routing_empty');
      }
      coords = best.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      info = { distanceM: best.distance, durationS: best.duration, fallback: false };
    } catch {
      const direct = haversineM(candidate.lat, candidate.lng, target.lat, target.lng);
      coords = [
        [candidate.lat, candidate.lng],
        [target.lat, target.lng],
      ];
      info = { distanceM: direct, durationS: direct / BIKE_SPEED_MS, fallback: true };
    } finally {
      clearTimeout(timer);
    }
    if (!aliveRef.current) return;
    setRoute(info);
    drawRoute(coords, info.fallback);
    startRide(coords, incident.id);
  };

  const resetAll = () => {
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    animTimerRef.current = null;
    for (const ref of [pickMarkerRef, incidentLayerRef, routeLayerRef, volunteerRef]) {
      if (ref.current) {
        ref.current.remove();
        ref.current = null;
      }
    }
    candidateMarkersRef.current = new Map();
    setIncident(null);
    setResponder(null);
    setRoute(null);
    setRemainingM(null);
    setResponseSeconds(null);
    setPoint(null);
    setError(null);
    setShowDevices(false);
    changePhase('idle');
    const map = mapRef.current;
    const center = config?.defaultCenter || FALLBACK_CENTER;
    if (map) map.setView([center.lat, center.lng], 14);
  };

  const cancelIncident = async () => {
    if (incident) {
      try {
        await apiFetch(`/api/incidents/${incident.id}/cancel`, { method: 'POST' });
      } catch {
        // Best effort — the demo reset must never get stuck on a network error.
      }
    }
    resetAll();
  };

  const inRadiusCandidates = incident ? incident.candidates.filter((c) => c.inRadius) : [];
  const loraAlertCount = inRadiusCandidates.filter((c) => c.alerts?.loraDownlink).length;
  const incidentUrl = incident ? `/incident/${incident.id}` : null;
  const wazeUrl = incident
    ? `https://waze.com/ul?ll=${incident.location.lat},${incident.location.lng}&navigate=yes`
    : null;
  const gmapsUrl = incident
    ? `https://www.google.com/maps/dir/?api=1&destination=${incident.location.lat},${incident.location.lng}&travelmode=bicycling`
    : null;

  const allDevices = incident
    ? [
        ...incident.candidates.map((c) => ({
          key: `c-${c.deviceId}`,
          label: c.label,
          source: c.locationSource,
          distanceM: c.distanceM,
          lastSeen: c.lastSeen,
          status: c.inRadius ? 'in' : 'out',
        })),
        ...(incident.meshNodes || []).map((n) => ({
          key: `m-${n.deviceId}`,
          label: n.label,
          source: 'lora',
          distanceM: Math.round(
            haversineM(incident.location.lat, incident.location.lng, n.lat, n.lng)
          ),
          lastSeen: n.lastSeen,
          status: 'mesh',
        })),
      ].sort((a, b) => a.distanceM - b.distanceM)
    : [];

  const settingsBusy = phase !== 'idle' && phase !== 'ready';

  return (
    <>
      <PageHero
        title="סימולטור קריאת מצוקה"
        lead="הדגמה חיה של שרשרת ההזנקה של דפי-נט: איתור מכשירים ברדיוס, דירוג מתנדבים לפי טריות שידור, הזנקה כפולה בסלולר וב-LoRa, מסלול אופניים אמיתי ומעקב חי של המוקד — הכול בדפדפן, ללא חומרה."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="red">בחירום אמיתי — חייגו 101</Badge>
          <Badge color="emerald">הדמיה מלאה בדפדפן</Badge>
          <Badge color="sky">מסלולי אופניים אמיתיים (OSRM)</Badge>
        </div>
      </PageHero>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <OfficialChannels className="mb-6" />

        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Control column — first in DOM so it stacks above the map on mobile. */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pe-1">
            {(phase === 'idle' || phase === 'ready' || phase === 'dispatching') && (
              <Card>
                <h2 className="text-lg font-bold text-slate-900">הגדרות התרחיש</h2>
                <div className="mt-4 space-y-4">
                  <Field
                    label="רדיוס הזנקה (מטרים)"
                    hint="בין 100 ל-20,000 מטרים — מכשירים מחוץ לרדיוס לא יוזנקו"
                  >
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={RADIUS_MIN}
                        max={RADIUS_MAX}
                        step={50}
                        value={radius}
                        disabled={settingsBusy}
                        onChange={(e) =>
                          setRadius(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        onBlur={() => setRadius(clampRadius(radius))}
                        className="w-28"
                      />
                      <input
                        type="range"
                        min={RADIUS_MIN}
                        max={RADIUS_MAX}
                        step={50}
                        value={clampRadius(radius)}
                        disabled={settingsBusy}
                        onChange={(e) => setRadius(Number(e.target.value))}
                        className="h-2 flex-1 cursor-pointer accent-red-600"
                        aria-label="רדיוס הזנקה"
                      />
                    </div>
                  </Field>
                  <SoundToggle on={soundOn} onToggle={toggleSound} />
                  <Alert tone={point ? 'success' : 'info'}>
                    {point ? (
                      <>
                        נקודת האירוע נבחרה:{' '}
                        <span dir="ltr" className="font-semibold">
                          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                        </span>{' '}
                        — אפשר לגרור את הסמן או ללחוץ במקום אחר.
                      </>
                    ) : (
                      'לחצו על המפה לבחירת נקודת האירוע'
                    )}
                  </Alert>
                  <Button
                    variant="emergency"
                    className="w-full"
                    disabled={!point || phase === 'dispatching'}
                    onClick={dispatchIncident}
                  >
                    {phase === 'dispatching' ? 'משדר קריאת מצוקה…' : '🚨 הפעל קריאת מצוקה'}
                  </Button>
                </div>
              </Card>
            )}

            {phase === 'alerted' && incident && (
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">הקריאה שודרה</h2>
                  <Badge color="amber" className="animate-pulse">
                    אירוע פעיל
                  </Badge>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">מועמדים בתוך הרדיוס</dt>
                    <dd className="font-bold text-slate-900">
                      {inRadiusCandidates.length} מתוך {incident.candidates.length}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">התראות Push + SMS</dt>
                    <dd className="font-bold text-slate-900">{inRadiusCandidates.length}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">פקודות LoRa Downlink</dt>
                    <dd className="font-bold text-emerald-700">{loraAlertCount}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  בחרו מתנדב מרשימת ההזנקה ולחצו על ״אישור הגעה״ — בדרך כלל המדורג הראשון.
                </p>
                <a
                  href={incidentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
                >
                  תצוגת מוקד ↗
                </a>
                <div className="mt-4 space-y-3">
                  <SoundToggle on={soundOn} onToggle={toggleSound} />
                  <Button variant="ghost" className="w-full" onClick={cancelIncident}>
                    ביטול אירוע והתחלה מחדש
                  </Button>
                </div>
              </Card>
            )}

            {phase === 'routing' && (
              <Card>
                <h2 className="text-lg font-bold text-slate-900">מחשב מסלול אופניים…</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  שולפים נתיב רכיבה אמיתי משירות הניווט (OSRM) — לא קו אווירי.
                </p>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-500" />
                </div>
              </Card>
            )}

            {phase === 'enroute' && incident && (
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">מעקב חי</h2>
                  <Badge color="sky">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500" />
                    המתנדב בדרך
                  </Badge>
                </div>
                {responder && (
                  <p className="mt-2 text-sm font-semibold text-slate-700">{responder.label}</p>
                )}
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold text-slate-500">מרחק שנותר</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900">
                    {formatDistanceM(remainingM)}
                  </p>
                </div>
                {route && (
                  <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <dt>אורך המסלול</dt>
                      <dd className="font-semibold">{formatDistanceM(route.distanceM)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt>זמן רכיבה משוער</dt>
                      <dd className="font-semibold">{formatSeconds(route.durationS)}</dd>
                    </div>
                    <p className="text-xs text-slate-400">מהירות ההדמיה מואצת פי {SIM_SPEED_FACTOR}</p>
                  </dl>
                )}
                {route?.fallback && (
                  <Alert tone="warning" className="mt-4">
                    שירות הניווט אינו זמין — מוצג קו משוער
                  </Alert>
                )}
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  המוקד מעודכן בזמן אמת — דיווח מיקום כל 2 שניות
                </div>
                <a
                  href={incidentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
                >
                  תצוגת מוקד ↗
                </a>
              </Card>
            )}

            {phase === 'arrived' && incident && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center shadow-sm">
                <div className="text-4xl">🎉</div>
                <h2 className="mt-2 text-xl font-extrabold text-emerald-900">
                  המתנדב הגיע אל המטופל!
                </h2>
                <p className="mt-1 text-sm text-emerald-800">
                  הדפיברילטור במקום — עכשיו כל שנייה קובעת.
                </p>
                <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">זמן תגובה כולל</p>
                  <p className="mt-1 text-3xl font-extrabold text-emerald-700">
                    {formatSeconds(responseSeconds)}
                  </p>
                </div>
                {route?.fallback && (
                  <Alert tone="warning" className="mt-4 text-start">
                    שירות הניווט אינו זמין — מוצג קו משוער
                  </Alert>
                )}
                <Button as={Link} href="/cpr" variant="emergency" className="mt-4 w-full">
                  פתחו את מדריך ההחייאה
                </Button>
                <div className="mt-4 text-start">
                  <p className="text-xs font-semibold text-slate-500">מצאו את המסלול באפליקציה:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={wazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                    >
                      Waze 🚗
                    </a>
                    <a
                      href={gmapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Google Maps 🚴
                    </a>
                  </div>
                </div>
                <Button variant="outline" className="mt-4 w-full bg-white" onClick={resetAll}>
                  אירוע חדש
                </Button>
                <a
                  href={incidentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  צפייה בסיכום האירוע במוקד ↗
                </a>
              </div>
            )}

            {incident && (
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">רשימת הזנקה — לפי דירוג</h2>
                  <Badge color="emerald">{inRadiusCandidates.length}</Badge>
                </div>
                {inRadiusCandidates.length === 0 ? (
                  <Alert tone="warning" className="mt-4">
                    אין מכשירי דפיברילטור בתוך הרדיוס שנבחר — הגדילו את הרדיוס ונסו שוב.
                  </Alert>
                ) : (
                  <ul className="mt-3 max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
                    {inRadiusCandidates.map((c) => {
                      const isResponder = responder?.deviceId === c.deviceId;
                      return (
                        <li
                          key={c.deviceId}
                          onClick={() => focusCandidate(c)}
                          className={`flex cursor-pointer items-start gap-3 py-3 transition hover:bg-slate-50 ${
                            isResponder ? 'bg-emerald-50' : ''
                          }`}
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                            {c.rank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {c.label}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {formatDistanceM(c.distanceM)} · {relativeTimeHe(c.lastSeen)}
                              {c.battery != null && <> · סוללה {c.battery}%</>}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <Badge color="sky">Push 📳</Badge>
                              <Badge color="slate">SMS ✉️</Badge>
                              {c.alerts?.loraDownlink && (
                                <Badge color="emerald" className="animate-blink">
                                  LoRa 📡
                                </Badge>
                              )}
                            </div>
                          </div>
                          {isResponder ? (
                            <Badge color="emerald" className="mt-0.5 shrink-0">
                              ✓ בדרך
                            </Badge>
                          ) : (
                            <Button
                              className="mt-0.5 shrink-0 px-3 py-1.5 text-xs"
                              disabled={phase !== 'alerted'}
                              onClick={(e) => {
                                e.stopPropagation();
                                acceptCandidate(c);
                              }}
                            >
                              אישור הגעה
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            )}
          </div>

          {/* Map column */}
          <div className="space-y-6 lg:col-span-2">
            <div
              ref={mapDivRef}
              className="relative z-0 h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm sm:h-[540px]"
              aria-label="מפת הסימולטור"
            />

            {!incident && (
              <Card>
                <h2 className="text-lg font-bold text-slate-900">מה מדגים הסימולטור?</h2>
                <ol className="mt-4 space-y-3">
                  {[
                    {
                      title: 'גידור גיאוגרפי (Geo-fencing)',
                      body: 'קריאת המצוקה מזניקה רק מכשירים שנמצאים בתוך רדיוס ההזנקה שבחרתם — השאר מוצגים אך אינם מוזנקים.',
                    },
                    {
                      title: 'דירוג לפי טריות שידור',
                      body: 'מתנדב ששידר טלמטריה לאחרונה ונמצא קרוב מדורג ראשון — מיקום ישן עלול להיות לא מדויק.',
                    },
                    {
                      title: 'הזנקה כפולה — סלולר + LoRa',
                      body: 'התראת Push ו-SMS ברשת הסלולרית, ובמקביל פקודת Downlink ברשת ה-LoRa שמפעילה צפצוף והבהוב על המכשיר — גם ללא קליטה סלולרית.',
                    },
                  ].map((item, i) => (
                    <li key={item.title} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {stats && (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <Badge color="slate">{stats.devices} מכשירים ברשת</Badge>
                    <Badge color="emerald">{stats.withLora} עם LoRa</Badge>
                    <Badge color="violet">{stats.repeaters} מגברי רשת</Badge>
                  </div>
                )}
              </Card>
            )}

            {incident && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowDevices((v) => !v)}
                  aria-expanded={showDevices}
                  className="flex w-full items-center justify-between gap-2 px-6 py-4 text-start transition hover:bg-slate-50"
                >
                  <span className="font-bold text-slate-900">
                    כל המכשירים ברשת אחרי הפיזור ({allDevices.length})
                  </span>
                  <span className="text-slate-400">{showDevices ? '▲' : '▼'}</span>
                </button>
                {showDevices && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs text-slate-500">
                          <th className="px-4 py-2 text-start font-semibold">מכשיר</th>
                          <th className="px-4 py-2 text-start font-semibold">מקור מיקום</th>
                          <th className="px-4 py-2 text-start font-semibold">מרחק מהאירוע</th>
                          <th className="px-4 py-2 text-start font-semibold">שידור אחרון</th>
                          <th className="px-4 py-2 text-start font-semibold">סטטוס</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allDevices.map((d) => (
                          <tr key={d.key} className="border-t border-slate-100">
                            <td className="px-4 py-2 font-medium text-slate-800">{d.label}</td>
                            <td className="px-4 py-2">
                              <Badge color={SOURCE_BADGE[d.source] || 'slate'}>
                                {sourceLabel(d.source)}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-slate-600">
                              {formatDistanceM(d.distanceM)}
                            </td>
                            <td className="px-4 py-2 text-slate-600">
                              {relativeTimeHe(d.lastSeen)}
                            </td>
                            <td className="px-4 py-2">
                              {d.status === 'in' && <Badge color="emerald">בתחום ההזנקה</Badge>}
                              {d.status === 'out' && <Badge color="slate">מחוץ לתחום</Badge>}
                              {d.status === 'mesh' && <Badge color="violet">מגבר רשת</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
