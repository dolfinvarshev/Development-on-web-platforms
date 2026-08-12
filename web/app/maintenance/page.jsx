import { fetchContent } from '@/lib/api';
import { Card, PageHero, Section } from '@/components/ui';
import ContentSections from '@/components/marketing/ContentSections';

export const metadata = { title: 'תחזוקה' };

const SAMPLE_TWEET = `{
  "devEUI": "A1B2C3D4E5F60718",
  "battery": 78,
  "lat": 32.0812,
  "lng": 34.7799,
  "ts": "2026-08-12T06:00:00Z"
}`;

export default async function MaintenancePage() {
  const page = await fetchContent('maintenance');
  return (
    <>
      <PageHero title={page?.title ?? 'תחזוקה — המערכת דואגת לעצמה'} lead={page?.intro} />

      <ContentSections page={page} />

      <Section className="pt-0">
        <Card>
          <h3 className="text-lg font-bold text-slate-900">כך נראה &quot;ציוץ&quot; LoRa יומי</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            אחת ליום משדר כל מכשיר LoRa הודעה קטנטנה עם המזהה שלו, מצב הסוללה ומיקום ה-GPS:
          </p>
          <pre
            dir="ltr"
            className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-start font-mono text-sm leading-relaxed text-emerald-300"
          >{SAMPLE_TWEET}</pre>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            השרת קולט את הציוץ ומעדכן את מרשם המכשירים אוטומטית, בלי מגע יד אדם (עדכון שקט). ירדה
            הסוללה מתחת ל-20%? נשלחת מיד התראת תחזוקה לבעל המכשיר, והמכשיר מסומן בלוח הבקרה עד
            להחלפת הסוללה.
          </p>
        </Card>
      </Section>
    </>
  );
}
