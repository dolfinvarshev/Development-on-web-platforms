'use client';

import { Badge } from '@/components/ui';
import { formatDateTimeHe, formatDistanceM, formatSeconds } from '@/lib/format';
import { STATUS_META } from './analytics-data';

const STATUS_BY_KEY = Object.fromEntries(STATUS_META.map((meta) => [meta.key, meta]));

/**
 * Accessible table twin of the charts: every value shown in any chart is readable
 * here without hover, color vision or a pointer. Newest incidents first.
 */
export default function IncidentsTable({ incidents }) {
  const rows = [...incidents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">
          כל האירועים — תאריך, סטטוס, מתנדב, זמן אישור, זמן תגובה ורדיוס
        </caption>
        <thead>
          <tr className="text-slate-500">
            <th className="py-2 pe-4 text-start font-semibold">תאריך ושעה</th>
            <th className="py-2 pe-4 text-start font-semibold">סטטוס</th>
            <th className="py-2 pe-4 text-start font-semibold">מתנדב</th>
            <th className="py-2 pe-4 text-start font-semibold">זמן אישור</th>
            <th className="py-2 pe-4 text-start font-semibold">זמן תגובה</th>
            <th className="py-2 text-start font-semibold">רדיוס</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inc) => {
            const status = STATUS_BY_KEY[inc.status];
            return (
              <tr key={inc.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap py-2.5 pe-4 tabular-nums text-slate-700">
                  {formatDateTimeHe(inc.createdAt)}
                </td>
                <td className="py-2.5 pe-4">
                  <Badge color={status?.badge ?? 'slate'}>{status?.label ?? inc.status}</Badge>
                </td>
                <td className="py-2.5 pe-4 text-slate-700">{inc.responder?.label ?? '—'}</td>
                <td className="whitespace-nowrap py-2.5 pe-4 tabular-nums text-slate-700">
                  {formatSeconds(inc.acceptSeconds)}
                </td>
                <td className="whitespace-nowrap py-2.5 pe-4 tabular-nums font-semibold text-slate-900">
                  {formatSeconds(inc.responseSeconds)}
                </td>
                <td className="whitespace-nowrap py-2.5 tabular-nums text-slate-700">
                  {formatDistanceM(inc.radiusM)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
