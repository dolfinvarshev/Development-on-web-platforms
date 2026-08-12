/** Centered spinner used by the admin shell and every tab while data loads. */
export default function Loading({ text = 'טוענים…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
        aria-hidden="true"
      />
      <span className="text-sm">{text}</span>
    </div>
  );
}
