import Link from 'next/link';
import { Alert, Badge, Button, Card, Section } from '@/components/ui';
import { apiFetch, fetchContent } from '@/lib/api';
import DistressFlowDiagram from '@/components/home/DistressFlowDiagram';

export const metadata = {
  description:
    'דפי-נט ממפה דפיברילטורים נייחים וניידים בזמן אמת ומזניקה מתנדבים בשני ערוצים במקביל — רשת LoRa/Meshtastic ו-SMS סלולרי. כי כל דקה קובעת.',
};

// Requirement 4: LoRa explained in exactly three lines (rendered as a numbered list).
const LORA_THREE_LINES = [
  'LoRa הוא שידור רדיו בתדר החופשי 433MHz שמעביר הודעות קטנות למרחק קילומטרים, בצריכת חשמל כה נמוכה שסוללה אחת מחזיקה שנים.',
  'כשאין קליטה סלולרית, קריאת המצוקה מדלגת ממכשיר למכשיר ברשת Meshtastic עד שער-גישה (למשל אמבולנס) שמעביר אותה לשרת יחד עם נקודת ה-GPS.',
  'כשיש קליטה, אותה קריאה יוצאת גם כ-SMS עם שם בעל הטלפון, מספרו ונקודת מיקומו — כך שההזנקה עובדת בכל תרחיש.',
];

export default async function HomePage() {
  const [page, stats] = await Promise.all([
    fetchContent('home'),
    apiFetch('/api/stats', { cache: 'no-store' }).catch(() => null),
  ]);

  const statTiles = [
    { label: 'מתנדבים ברשת', value: stats?.volunteers },
    { label: 'מכשירים ממופים', value: stats?.devices },
    { label: 'משדרי LoRa', value: stats?.withLora },
    { label: 'מכשירי לוויין MAGNUS', value: stats?.withMagnus },
  ];

  return (
    <div>
      {/* ── Hero ── */}
      <div className="border-b border-emerald-100 bg-gradient-to-b from-emerald-50 via-emerald-50/60 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Badge color="emerald">מיפוי דפיברילטורים בזמן אמת · LoRa · Meshtastic · לוויין MAGNUS</Badge>
          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {page?.title || 'דפי-נט — כל דקה קובעת'}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">
            {page?.intro ||
              'רשת ארצית שממפה דפיברילטורים נייחים וניידים בזמן אמת ומזניקה את המתנדב הקרוב ביותר — גם היכן שאין קליטה סלולרית.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button as={Link} href="/register" className="px-6 py-3 text-base">
              הצטרפו לרשת עכשיו
            </Button>
            <Button as={Link} href="/simulator" variant="outline" className="px-6 py-3 text-base">
              צפו בסימולטור החי
            </Button>
          </div>
          <p className="mt-6 text-sm font-bold text-red-600">במקרה חירום אמיתי — חייגו 101</p>
        </div>
      </div>

      {/* ── Requirement 4: LoRa in exactly three lines ── */}
      <Section>
        <Card className="border-emerald-300 bg-emerald-50/50">
          <h2 className="text-2xl font-bold text-slate-900">LoRa בשלוש שורות</h2>
          <ol className="mt-6 space-y-5">
            {LORA_THREE_LINES.map((line, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="leading-relaxed text-slate-700">{line}</p>
              </li>
            ))}
          </ol>
        </Card>
      </Section>

      {/* ── Requirement 4: the distress-flow diagram ── */}
      <Section
        title="כך מגיעה קריאת מצוקה לדפיברילטור הקרוב"
        subtitle="שני ערוצים במקביל — רדיו LoRa ברשת Meshtastic ו-SMS סלולרי — כדי שההתראה תעבור בכל תנאי קליטה."
      >
        <Card>
          <DistressFlowDiagram />
        </Card>
      </Section>

      {/* ── Live stats band ── */}
      <div className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-center text-sm font-semibold text-emerald-400">הרשת במספרים — נתונים חיים מהשרת</h2>
          <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
            {statTiles.map((tile) => (
              <div key={tile.label} className="text-center">
                <dd className="text-4xl font-extrabold text-emerald-300 sm:text-5xl">{tile.value ?? '—'}</dd>
                <dt className="mt-2 text-sm font-medium text-slate-300">{tile.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── CMS-managed content ── */}
      {page ? (
        <>
          {page.sections?.length > 0 && (
            <Section>
              <div className="grid gap-6 md:grid-cols-2">
                {page.sections.map((section, i) => (
                  <Card key={i}>
                    <h3 className="text-lg font-bold text-slate-900">{section.heading}</h3>
                    <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-600">{section.body}</p>
                  </Card>
                ))}
              </div>
            </Section>
          )}
          {page.links?.length > 0 && (
            <Section
              title="הערוצים הרשמיים"
              subtitle="במקרה אמת — קודם כול 101. המפות הרשמיות הן תמיד המקור המחייב."
            >
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {page.links.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="group block">
                    <Card className="h-full transition group-hover:border-emerald-300 group-hover:shadow-md">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-emerald-700">{link.label}</span>
                        <span className="text-slate-400 transition group-hover:text-emerald-600" aria-hidden="true">
                          ↗
                        </span>
                      </div>
                      {link.description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{link.description}</p>}
                    </Card>
                  </a>
                ))}
              </div>
            </Section>
          )}
        </>
      ) : (
        <Section>
          <Alert tone="warning">התוכן אינו זמין — ודאו שהשרת פועל.</Alert>
        </Section>
      )}

      {/* ── $50 repeater program banner + guide link ── */}
      <Section className="pb-16">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-700 p-8 text-white shadow-sm sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold">גם בלי דפיברילטור — אתם מצילים חיים</h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-emerald-50">
                הצטרפו כנשאי מגבר LoRa וקבלו מענק של 50$: כל מכשיר כזה מרחיב את רשת הממסר ומעביר הלאה
                קריאות מצוקה מאזורים ללא קליטה סלולרית.
              </p>
            </div>
            <Link
              href="/join"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              לתוכנית המענק — 50$
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-slate-600">
          רוצים להבין את הטכנולוגיה?{' '}
          <Link href="/guide" className="font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-800">
            למדריך המלא על LoRa, Meshtastic ולוויין MAGNUS
          </Link>
        </p>
      </Section>
    </div>
  );
}
