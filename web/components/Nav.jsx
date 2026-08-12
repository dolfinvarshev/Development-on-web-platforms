'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'ראשי' },
  { href: '/guide', label: 'איך זה עובד' },
  { href: '/join', label: 'הצטרפות' },
  { href: '/register', label: 'הרשמה' },
  { href: '/shop', label: 'רכישת ציוד' },
  { href: '/maintenance', label: 'תחזוקה' },
  { href: '/simulator', label: 'סימולטור' },
  { href: '/cpr', label: 'מדריך החייאה' },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return `rounded-lg px-3 py-2 text-sm font-medium transition ${
      active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;
  };

  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-600 text-lg text-white" aria-hidden>
            ⚡
          </span>
          <span className="text-lg font-bold text-slate-900">
            דפי<span className="text-emerald-600">-נט</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="ניווט ראשי">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          <Link
            href="/admin"
            className="ms-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            ניהול
          </Link>
        </nav>

        <button
          className="grid h-10 w-10 place-items-center rounded-lg text-2xl text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'סגירת תפריט' : 'פתיחת תפריט'}
          aria-expanded={open}
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-100 bg-white px-4 pb-4 lg:hidden" aria-label="ניווט נייד">
          {[...LINKS, { href: '/admin', label: 'ניהול' }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
