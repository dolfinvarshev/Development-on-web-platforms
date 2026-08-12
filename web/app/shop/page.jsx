import Link from 'next/link';
import { fetchContent } from '@/lib/api';
import { Alert, Button, Card, PageHero, Section } from '@/components/ui';
import ContentSections from '@/components/marketing/ContentSections';

export const metadata = { title: 'רכישת ציוד LoRa' };

export default async function ShopPage() {
  const page = await fetchContent('shop');
  return (
    <>
      <PageHero title={page?.title ?? 'רכישת ציוד LoRa'} lead={page?.intro} />

      <Section className="pb-0">
        <Alert tone="danger" title="חשוב: תדר 433MHz בלבד">
          בהזמנה בחרו תמיד את גרסת ה-433MHz — התדר החופשי בישראל שבו פועלת רשת דפי-נט. מכשיר בתדר
          אחר לא ישתתף ברשת.
        </Alert>
      </Section>

      {/* The CMS links of this page are the stores — rendered as a prominent store grid. */}
      <ContentSections page={page} linksVariant="store" linksTitle="החנויות המומלצות" />

      <Section className="pt-0">
        <Card className="sm:max-w-xl">
          <h3 className="text-lg font-bold text-slate-900">מה זה DevEUI?</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            המזהה הייחודי של רכיב ה-LoRa — מחרוזת הקסדצימלית שמודפסת על המכשיר עצמו, למשל{' '}
            <code
              dir="ltr"
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800"
            >
              A1B2C3D4E5F60718
            </code>
            . לאחר הרכישה תזינו אותו בטופס ההרשמה — כך המערכת משייכת את המשדר אליכם.
          </p>
          <Button as={Link} href="/register" variant="outline" className="mt-4">
            לטופס ההרשמה
          </Button>
        </Card>
      </Section>
    </>
  );
}
