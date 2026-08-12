import { Badge } from '@/components/ui';
import { relativeTimeHe } from '@/lib/format';

/** Badge color + Hebrew label per AlertLog.type (docs/ARCHITECTURE.md §5). */
export const ALERT_TYPE_META = {
  maintenance_battery: { color: 'amber', label: 'תחזוקה' },
  incident_push: { color: 'sky', label: 'הזנקה Push' },
  incident_lora_downlink: { color: 'emerald', label: 'LoRa Downlink' },
  incident_sms: { color: 'slate', label: 'SMS' },
};

/** Uniform alert rows, shared by the dashboard (latest 8) and the full alerts log. */
export default function AlertList({ alerts }) {
  if (alerts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        אין התראות להצגה עדיין — הזניקו אירוע בסימולטור או חכו להתראת תחזוקה
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {alerts.map((alert) => {
        const meta = ALERT_TYPE_META[alert.type] ?? { color: 'slate', label: alert.type };
        return (
          <li key={alert.id} className="flex items-start gap-3 py-3">
            <Badge color={meta.color} className="mt-0.5 shrink-0">
              {meta.label}
            </Badge>
            <p className="flex-1 text-sm leading-relaxed text-slate-700">{alert.message}</p>
            <span className="shrink-0 text-xs text-slate-400">{relativeTimeHe(alert.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
