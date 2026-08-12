/** Hebrew formatting helpers shared by all pages. */

export function relativeTimeHe(iso) {
  if (!iso) return 'לא דווח';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'לא דווח';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'לפני רגע';
  if (min === 1) return 'לפני דקה';
  if (min < 60) return `לפני ${min} דקות`;
  const hours = Math.floor(min / 60);
  if (hours === 1) return 'לפני שעה';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'לפני יום';
  return `לפני ${days} ימים`;
}

export function formatDistanceM(m) {
  if (m == null || Number.isNaN(m)) return '—';
  if (m < 1000) return `${Math.round(m)} מ׳`;
  return `${(m / 1000).toFixed(1)} ק״מ`;
}

export function formatDateTimeHe(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatSeconds(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m} דק׳ ${s} שנ׳` : `${s} שנ׳`;
}

const CATEGORY_LABELS = {
  defib_lora: 'בעל/ת דפיברילטור + LoRa',
  defib_only: 'בעל/ת דפיברילטור (טלפון בלבד)',
  lora_only: 'נושא/ת LoRa — מגבר רשת',
};

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category || '—';
}

const SOURCE_LABELS = {
  lora: 'LoRa',
  magnus: 'לוויין MAGNUS',
  phone: 'טלפון סלולרי',
};

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || source || '—';
}
