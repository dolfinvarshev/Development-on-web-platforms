'use client';

import { useMemo, useState } from 'react';
import { formatDateTimeHe, formatSeconds } from '@/lib/format';
import { SERIES, buildMinuteScale, timeOfDayHe } from './analytics-data';

// viewBox geometry — the SVG scales responsively (width 100%, height auto).
const VIEW_W = 720;
const VIEW_H = 260;
const PAD = { top: 26, bottom: 30, left: 10, right: 48 }; // right pad hosts the y labels (RTL)
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const BASELINE = VIEW_H - PAD.bottom;
const SEGMENT_GAP = 2; // surface gap between stacked segments
const GRID = '#E2E8F0'; // slate-200
const TICK_INK = '#64748B'; // slate-500
const LABEL_INK = '#475569'; // slate-600

/** Rect path whose TOP corners only are rounded — the outer end of the topmost segment. */
function roundedTopRect(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * Stacked vertical bars of the last resolved incidents, oldest (right) → newest (left)
 * to match the RTL reading direction. Bottom segment = time until a volunteer accepted,
 * top segment = travel time from acceptance to arrival.
 */
export default function ResponseTimesChart({ incidents }) {
  const [hovered, setHovered] = useState(null);

  const { scale, bars, tallestIndex } = useMemo(() => {
    const maxResponse = Math.max(...incidents.map((inc) => inc.responseSeconds));
    const minuteScale = buildMinuteScale(maxResponse);
    const toHeight = (seconds) => (seconds / minuteScale.axisMaxSeconds) * PLOT_H;

    const slot = PLOT_W / incidents.length;
    const barW = Math.min(24, slot * 0.6); // thin bars: ≤60% of the slot, capped at 24px

    let tallest = 0;
    const items = incidents.map((inc, i) => {
      const accept = inc.acceptSeconds ?? 0;
      const travel = Math.max(inc.responseSeconds - accept, 0);
      if (inc.responseSeconds > incidents[tallest].responseSeconds) tallest = i;

      // Oldest sits in the rightmost slot; newer incidents grow leftward.
      const centerX = PAD.left + PLOT_W - slot * (i + 0.5);

      // Stack bottom-up; the 2px surface gap is carved out of each upper segment.
      const stack = [
        { seconds: accept, color: SERIES.accept.color },
        { seconds: travel, color: SERIES.travel.color },
      ].filter((seg) => seg.seconds > 0);

      let stackTop = BASELINE;
      const segments = stack.map((seg, idx) => {
        const gap = idx > 0 ? SEGMENT_GAP : 0;
        const height = Math.max(toHeight(seg.seconds) - gap, 1.25);
        const y = stackTop - gap - height;
        stackTop = y;
        return { ...seg, y, height, isTop: idx === stack.length - 1 };
      });

      return {
        incident: inc,
        accept,
        travel,
        centerX,
        slot,
        barW,
        segments,
        topY: BASELINE - toHeight(inc.responseSeconds),
      };
    });

    return { scale: minuteScale, bars: items, tallestIndex: tallest };
  }, [incidents]);

  // Thin out x labels when slots get crowded, always keeping the newest labeled.
  const labelEvery = incidents.length > 10 ? 2 : 1;
  const hoveredBar = hovered != null ? bars[hovered] : null;

  return (
    <div onMouseLeave={() => setHovered(null)}>
      {/* Legend — mandatory for two series; identity never rides on color alone. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        {[SERIES.accept, SERIES.travel].map((series) => (
          <span key={series.label} className="inline-flex items-center gap-2 text-sm text-slate-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: series.color }}
              aria-hidden="true"
            />
            {series.label}
          </span>
        ))}
        <span className="ms-auto text-xs text-slate-400">ציר אנכי: דקות · מהישן (מימין) לחדש (משמאל)</span>
      </div>

      {/* direction:ltr pins SVG text-anchor semantics; all in-SVG text is numeric. */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block w-full"
        style={{ height: 'auto', direction: 'ltr' }}
        role="img"
        aria-label="תרשים עמודות של זמני תגובה לאירועים האחרונים — הנתונים המלאים מופיעים בטבלה שבהמשך העמוד"
      >
        {/* Recessive horizontal gridlines + baseline; no vertical grid, no axis box. */}
        <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={BASELINE} y2={BASELINE} stroke={GRID} strokeWidth="1" />
        {scale.ticks.map((tick) => {
          const y = BASELINE - (tick.seconds / scale.axisMaxSeconds) * PLOT_H;
          return (
            <g key={tick.seconds}>
              <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={y} y2={y} stroke={GRID} strokeWidth="1" />
              <text x={PAD.left + PLOT_W + 8} y={y + 3.5} fontSize="11" fill={TICK_INK}>
                {tick.label}
              </text>
            </g>
          );
        })}

        {bars.map((bar, i) => (
          <g key={bar.incident.id ?? i} opacity={hovered === i ? 0.75 : 1}>
            {bar.segments.map((seg) =>
              seg.isTop ? (
                <path
                  key={seg.color}
                  d={roundedTopRect(bar.centerX - bar.barW / 2, seg.y, bar.barW, seg.height, 4)}
                  fill={seg.color}
                />
              ) : (
                <rect
                  key={seg.color}
                  x={bar.centerX - bar.barW / 2}
                  y={seg.y}
                  width={bar.barW}
                  height={seg.height}
                  fill={seg.color}
                />
              )
            )}
          </g>
        ))}

        {/* Selective direct label: only the slowest (tallest) incident, in slate ink. */}
        {bars[tallestIndex] && (
          <text
            x={bars[tallestIndex].centerX}
            y={bars[tallestIndex].topY - 6}
            fontSize="11"
            fontWeight="600"
            fill={LABEL_INK}
            textAnchor="middle"
          >
            {formatSeconds(bars[tallestIndex].incident.responseSeconds)}
          </text>
        )}

        {/* x tick labels — time of day, thinned when crowded. */}
        {bars.map((bar, i) =>
          (incidents.length - 1 - i) % labelEvery === 0 ? (
            <text
              key={`label-${bar.incident.id ?? i}`}
              x={bar.centerX}
              y={BASELINE + 18}
              fontSize="11"
              fill={TICK_INK}
              textAnchor="middle"
            >
              {timeOfDayHe(bar.incident.createdAt)}
            </text>
          ) : null
        )}

        {/* Hover layer: a full-slot transparent hit rect per bar, taller than the bar. */}
        {bars.map((bar, i) => (
          <rect
            key={`hit-${bar.incident.id ?? i}`}
            x={bar.centerX - bar.slot / 2}
            y={PAD.top - 12}
            width={bar.slot}
            height={BASELINE - PAD.top + 36}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}
      </svg>

      {hoveredBar && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: `clamp(6rem, ${(hoveredBar.centerX / VIEW_W) * 100}%, calc(100% - 6rem))`,
            top: `${(hoveredBar.topY / VIEW_H) * 100}%`,
            transform: 'translate(-50%, -100%) translateY(-8px)',
          }}
        >
          <p className="mb-1 font-semibold text-slate-500">
            {formatDateTimeHe(hoveredBar.incident.createdAt)}
          </p>
          <p className="flex items-center gap-2">
            <span className="inline-block h-1 w-2.5 rounded-full" style={{ backgroundColor: SERIES.accept.color }} />
            <span className="font-semibold text-slate-900">{formatSeconds(hoveredBar.incident.acceptSeconds)}</span>
            <span className="text-slate-500">{SERIES.accept.label}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-2">
            <span className="inline-block h-1 w-2.5 rounded-full" style={{ backgroundColor: SERIES.travel.color }} />
            <span className="font-semibold text-slate-900">{formatSeconds(hoveredBar.travel)}</span>
            <span className="text-slate-500">{SERIES.travel.label}</span>
          </p>
          <p className="mt-1 border-t border-slate-100 pt-1">
            <span className="font-bold text-slate-900">{formatSeconds(hoveredBar.incident.responseSeconds)}</span>
            <span className="ms-2 text-slate-500">סה״כ</span>
          </p>
        </div>
      )}
    </div>
  );
}
