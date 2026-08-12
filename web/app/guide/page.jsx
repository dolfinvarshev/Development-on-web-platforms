import Link from 'next/link';
import { fetchContent } from '@/lib/api';
import { Button, PageHero, Section } from '@/components/ui';
import ContentSections from '@/components/marketing/ContentSections';
import OfficialChannels from '@/components/OfficialChannels';

export const metadata = { title: 'איך זה עובד' };

// Fixed medical-fact strip — deliberately not CMS-editable.
const RESCUE_WINDOW = [
  {
    time: '0-4 דקות',
    body: 'חלון הזהב — שוק חשמלי כעת מעלה שרידות ל-70% ומעלה',
    cardClass: 'border-emerald-200 bg-emerald-50',
    timeClass: 'text-emerald-700',
  },
  {
    time: '4-10 דקות',
    body: 'כל דקה גורעת 7%-10% מסיכויי ההישרדות — נזק מוחי מתחיל',
    cardClass: 'border-amber-200 bg-amber-50',
    timeClass: 'text-amber-700',
  },
  {
    time: '10+ דקות',
    body: 'עיסויי לב שומרים זרימת דם מינימלית — הדפיברילטור עדיין עשוי להציל',
    cardClass: 'border-red-200 bg-red-50',
    timeClass: 'text-red-700',
  },
];

export default async function GuidePage() {
  const page = await fetchContent('guide');
  return (
    <>
      <PageHero title={page?.title ?? 'איך זה עובד — המדריך המלא'} lead={page?.intro} />

      {/* This page teaches how fast survival drops; the official route out must be
          actionable right here, not only in the footer. */}
      <Section className="pb-0">
        <OfficialChannels />
      </Section>

      <ContentSections page={page} />

      <Section
        className="pt-0"
        title="חלון הזמן להצלה"
        subtitle="בדום לב הזמן הוא המשאב היקר ביותר — כך נראה ציר הזמן מרגע הקריסה."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {RESCUE_WINDOW.map((phase) => (
            <div key={phase.time} className={`rounded-2xl border p-6 shadow-sm ${phase.cardClass}`}>
              <p className={`text-2xl font-extrabold ${phase.timeClass}`}>{phase.time}</p>
              <p className="mt-2 leading-relaxed text-slate-700">{phase.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button as={Link} href="/simulator" variant="emergency">
            ראו את זה קורה בסימולטור
          </Button>
          <Button as={Link} href="/register" variant="outline">
            הצטרפו לרשת
          </Button>
        </div>
      </Section>
    </>
  );
}
