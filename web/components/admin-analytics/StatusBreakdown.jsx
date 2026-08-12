'use client';

import { STATUS_META } from './analytics-data';

/**
 * One horizontal stacked bar of incident statuses with 2px surface gaps between
 * segments, plus a chip row (dot + Hebrew label + count) so the numbers are never
 * carried by color alone. The bar itself is decorative — the chips are the data.
 */
export default function StatusBreakdown({ statusCounts }) {
  const present = STATUS_META.filter((meta) => statusCounts[meta.key] > 0);

  return (
    <div>
      {present.length > 0 && (
        <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
          {present.map((meta) => (
            <div
              key={meta.key}
              // flexGrow keeps the segments exactly proportional without % rounding.
              style={{ flexGrow: statusCounts[meta.key], flexBasis: 0, backgroundColor: meta.color }}
            />
          ))}
        </div>
      )}

      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {STATUS_META.map((meta) => (
          <li key={meta.key} className="inline-flex items-center gap-2 text-sm text-slate-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: meta.color }}
              aria-hidden="true"
            />
            {meta.label}
            <span className="font-bold text-slate-900">{statusCounts[meta.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
