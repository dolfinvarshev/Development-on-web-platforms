/**
 * Shared UI kit — every page builds from these primitives so the whole site
 * looks like one product. Design tokens: docs/ARCHITECTURE.md §7.
 */

const BUTTON_VARIANTS = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
  emergency: 'bg-red-600 text-white hover:bg-red-700',
  outline: 'border border-emerald-600 text-emerald-700 hover:bg-emerald-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({ variant = 'primary', className = '', as: Comp = 'button', ...props }) {
  return (
    <Comp
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = '', children }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHero({ title, lead, children }) {
  return (
    <div className="border-b border-emerald-100 bg-gradient-to-b from-emerald-50 to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">{title}</h1>
        {lead && <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">{lead}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

export function Section({ title, subtitle, className = '', children }) {
  return (
    <section className={`mx-auto max-w-6xl px-4 py-10 ${className}`}>
      {title && <h2 className="text-2xl font-bold text-slate-900">{title}</h2>}
      {subtitle && <p className="mt-2 max-w-3xl text-slate-600">{subtitle}</p>}
      <div className={title || subtitle ? 'mt-6' : ''}>{children}</div>
    </section>
  );
}

const BADGE_COLORS = {
  emerald: 'bg-emerald-100 text-emerald-800',
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  sky: 'bg-sky-100 text-sky-800',
  slate: 'bg-slate-100 text-slate-700',
  violet: 'bg-violet-100 text-violet-800',
};

export function Badge({ color = 'emerald', className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_COLORS[color]} ${className}`}>
      {children}
    </span>
  );
}

export function Field({ label, required, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ms-1 text-red-600" title="שדה חובה">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100';

export function Input({ className = '', ...props }) {
  return <input className={`${INPUT_CLASS} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${INPUT_CLASS} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ className = '', ...props }) {
  return <textarea className={`${INPUT_CLASS} min-h-24 ${className}`} {...props} />;
}

const ALERT_TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
};

export function Alert({ tone = 'info', title, className = '', children }) {
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed ${ALERT_TONES[tone]} ${className}`} role="alert">
      {title && <p className="mb-1 font-bold">{title}</p>}
      {children}
    </div>
  );
}
