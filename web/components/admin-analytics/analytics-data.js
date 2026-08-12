/**
 * Pure data derivation for the response-time analytics dashboard.
 * No React, no fetch — every function maps plain input to plain output so the
 * logic is unit-testable and easy to defend line by line.
 *
 * Input shape (GET /api/incidents, docs/ARCHITECTURE.md §6):
 *   { id, createdAt, status, responder, acceptSeconds, responseSeconds, radiusM, ... }
 * An incident counts as "resolved" for analytics when responseSeconds != null.
 */

/** The two stacked series of the main chart. Palette validated for CVD (deutan ΔE 58). */
export const SERIES = {
  accept: { label: 'עד אישור מתנדב', color: '#0284C7' }, // sky-600
  travel: { label: 'מאישור עד הגעה', color: '#059669' }, // emerald-600
};

/** Fixed display order + colors + Hebrew labels per incident status (never color alone). */
export const STATUS_META = [
  { key: 'resolved', label: 'טופל', color: '#059669', badge: 'emerald' },
  { key: 'responding', label: 'בטיפול', color: '#0284C7', badge: 'sky' },
  { key: 'active', label: 'פעיל', color: '#D97706', badge: 'amber' },
  { key: 'cancelled', label: 'בוטל', color: '#64748B', badge: 'slate' },
];

/** Median of a numeric array; null for an empty array. */
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Derives everything the dashboard renders from the raw incident list:
 * counters, averages, the last-20 resolved series and the status histogram.
 */
export function deriveAnalytics(incidents) {
  const list = Array.isArray(incidents) ? incidents : [];

  const resolved = list.filter((inc) => inc.responseSeconds != null);
  const responseTimes = resolved.map((inc) => inc.responseSeconds);
  const acceptTimes = list
    .filter((inc) => inc.acceptSeconds != null)
    .map((inc) => inc.acceptSeconds);

  // Oldest→newest so the chart can lay bars out right-to-left chronologically.
  const chronological = [...resolved].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  const statusCounts = { resolved: 0, responding: 0, active: 0, cancelled: 0 };
  for (const inc of list) {
    if (statusCounts[inc.status] !== undefined) statusCounts[inc.status] += 1;
  }

  return {
    totalCount: list.length,
    resolvedCount: resolved.length,
    avgResponseSeconds: responseTimes.length
      ? responseTimes.reduce((sum, v) => sum + v, 0) / responseTimes.length
      : null,
    medianAcceptSeconds: median(acceptTimes),
    recentResolved: chronological.slice(-20),
    statusCounts,
  };
}

/** Candidate y-axis tick steps, in minutes — chosen so 3–5 gridlines cover the data. */
const TICK_STEPS_MINUTES = [0.5, 1, 2, 3, 5, 10, 15, 20, 30, 60, 120, 240];

/**
 * Builds a "nice" y scale in minutes for a maximum value given in seconds:
 * the smallest clean step that covers the maximum with at most 5 ticks.
 * Returns { axisMaxSeconds, ticks:[{ seconds, label }] } (labels are minute values).
 */
export function buildMinuteScale(maxSeconds) {
  const maxMinutes = Math.max(maxSeconds || 0, 30) / 60; // floor of 30s avoids a degenerate axis
  let step = TICK_STEPS_MINUTES[TICK_STEPS_MINUTES.length - 1];
  for (const candidate of TICK_STEPS_MINUTES) {
    if (Math.ceil(maxMinutes / candidate) <= 5) {
      step = candidate;
      break;
    }
  }
  const tickCount = Math.max(Math.ceil(maxMinutes / step), 1);
  const ticks = [];
  for (let i = 1; i <= tickCount; i += 1) {
    const minutes = i * step;
    ticks.push({
      seconds: minutes * 60,
      label: Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1),
    });
  }
  return { axisMaxSeconds: tickCount * step * 60, ticks };
}

/** 'HH:MM' time-of-day for x tick labels (24h, he-IL). */
export function timeOfDayHe(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}
