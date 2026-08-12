/**
 * [F4] Shared Leaflet helpers for the simulator and the call-center view.
 * The Leaflet module (L) is always passed in by the caller, so this file never
 * touches `window` and stays SSR-safe. All markers are inline-styled divIcons —
 * Leaflet's default icon images break under bundlers.
 */

import { formatDistanceM, relativeTimeHe, sourceLabel } from '@/lib/format';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

const EARTH_RADIUS_M = 6371000;

export function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Cumulative distance along a [lat,lng] polyline — feeds the ride animation. */
export function cumulativeDistances(latlngs) {
  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < latlngs.length; i += 1) {
    total += haversineM(latlngs[i - 1][0], latlngs[i - 1][1], latlngs[i][0], latlngs[i][1]);
    cumulative.push(total);
  }
  return { total, cumulative };
}

/** Interpolated [lat,lng] at `dist` meters along the polyline. */
export function pointAlong(latlngs, cumulative, dist) {
  if (dist <= 0) return latlngs[0];
  const total = cumulative[cumulative.length - 1];
  if (dist >= total) return latlngs[latlngs.length - 1];
  let i = 1;
  while (i < cumulative.length && cumulative[i] < dist) i += 1;
  const segment = cumulative[i] - cumulative[i - 1] || 1;
  const t = (dist - cumulative[i - 1]) / segment;
  const [aLat, aLng] = latlngs[i - 1];
  const [bLat, bLng] = latlngs[i];
  return [aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t];
}

// ---- divIcon factories ----

/** Draggable pre-dispatch marker — where the distress call will be raised. */
export function pickIcon(L) {
  return L.divIcon({
    className: '',
    html: '<div style="width:22px;height:22px;border-radius:9999px;background:#dc2626;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:grab"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** The active incident — red core with an expanding pulse ring. */
export function incidentIcon(L) {
  return L.divIcon({
    className: '',
    html:
      '<div style="position:relative;width:38px;height:38px">' +
      '<span class="animate-pulse-ring" style="position:absolute;inset:0;border-radius:9999px;background:#dc2626"></span>' +
      '<span style="position:absolute;inset:7px;border-radius:9999px;background:#dc2626;border:3px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.45)"></span>' +
      '</div>',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

/** In-radius candidate — emerald circle badge showing the dispatch rank. */
export function rankIcon(L, rank) {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:#059669;color:#ffffff;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">${Number(rank) || ''}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/** Small colored dot — out-of-radius devices (slate) and mesh nodes (violet). */
export function dotIcon(L, color, size) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:1.5px solid #ffffff;box-shadow:0 1px 2px rgba(0,0,0,0.3)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** The responding volunteer riding to the scene. */
export function volunteerIcon(L) {
  return L.divIcon({
    className: '',
    html: '<div style="width:32px;height:32px;border-radius:9999px;background:#ffffff;border:3px solid #059669;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:17px">🚴</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/**
 * Hebrew popup for any device marker: label, location source, last transmission,
 * battery (when reported) and distance from the incident.
 */
export function devicePopupHtml({ label, locationSource, lastSeen, battery, distanceM }) {
  const rows = [
    `<div style="font-weight:700;margin-bottom:2px">${escapeHtml(label)}</div>`,
    `<div>מקור מיקום: ${escapeHtml(sourceLabel(locationSource))}</div>`,
    `<div>שידור אחרון: ${escapeHtml(relativeTimeHe(lastSeen))}</div>`,
  ];
  if (battery != null) rows.push(`<div>סוללה: ${escapeHtml(battery)}%</div>`);
  if (distanceM != null) rows.push(`<div>מרחק מהאירוע: ${escapeHtml(formatDistanceM(distanceM))}</div>`);
  return `<div dir="rtl" style="font-family:inherit;font-size:13px;line-height:1.7;min-width:170px;text-align:right">${rows.join('')}</div>`;
}
