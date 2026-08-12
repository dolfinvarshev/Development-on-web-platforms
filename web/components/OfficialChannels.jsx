import { Button } from '@/components/ui';

/**
 * The official emergency channels, which always take precedence over DefiNet
 * itself: MDA's 101 dispatch line plus the two authoritative defibrillator maps
 * ("Where is Defi" and MDA's national registry).
 *
 * This strip belongs on every surface a user might reach during a real cardiac
 * event — the simulator, the CPR guide and the call-center incident view — so
 * the official route is never more than one tap away.
 */

const MAPS = [
  {
    label: 'איפה דפי? — מפת דפיברילטורים',
    href: 'https://defi.co.il/#/map',
    hint: 'המפה הקהילתית של הדפיברילטורים בישראל',
  },
  {
    label: 'מאגר הדפיברילטורים של מד״א',
    href: 'https://www.mdais.org/about/mdefi',
    hint: 'המאגר הלאומי הרשמי',
  },
];

export default function OfficialChannels({ className = '' }) {
  return (
    <aside
      className={`rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5 ${className}`}
      aria-label="ערוצי החירום הרשמיים"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-red-700">קודם כול — הערוצים הרשמיים</p>
          <p className="mt-1 text-sm leading-relaxed text-red-800/80">
            דפי-נט משלימה את מערך החירום ואינה מחליפה אותו. בכל חשד לדום לב חייגו מיד 101,
            והיעזרו במפות הדפיברילטורים הרשמיות.
          </p>
        </div>
        <Button as="a" href="tel:101" variant="emergency" className="shrink-0 px-6 text-base">
          חיוג 101
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {MAPS.map((map) => (
          <a
            key={map.href}
            href={map.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 transition hover:border-red-300 hover:bg-red-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-red-700">{map.label}</span>
              <span className="block truncate text-xs text-slate-500">{map.hint}</span>
            </span>
            <span className="shrink-0 text-red-400 transition group-hover:text-red-600" aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
}
