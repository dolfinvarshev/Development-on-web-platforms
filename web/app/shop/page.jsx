import Link from 'next/link';
import { fetchContent } from '@/lib/api';
import { Alert, Button, Card, PageHero, Section } from '@/components/ui';
import ContentSections from '@/components/marketing/ContentSections';

export const metadata = { title: 'רכישת ציוד LoRa' };

/**
 * Requirement 14 (marketing of at least three LoRa shops, 433MHz emphasized) must
 * hold even when the API/Mongo is unreachable or an admin empties the CMS link
 * list — so the store list ships hardcoded here and the CMS only overrides it.
 */
const FALLBACK_SHOPS = [
  {
    label: 'LILYGO — החנות הרשמית',
    url: 'https://lilygo.cc',
    description: 'יצרנית T-Echo ו-T-Beam. בדף המוצר בחרו את גרסת 433MHz.',
  },
  {
    label: 'Heltec — החנות הרשמית',
    url: 'https://heltec.org',
    description: 'לוחות LoRa32 לפיתוח ולנשיאה — הקפידו על הדגם בתדר 433MHz.',
  },
  {
    label: 'RAKwireless — חנות היצרן',
    url: 'https://store.rakwireless.com',
    description: 'מודולי WisBlock ומכשירי WisMesh תואמי Meshtastic, כולל גרסאות 433MHz.',
  },
  {
    label: 'AliExpress — חיפוש LoRa 433MHz Meshtastic',
    url: 'https://www.aliexpress.com/w/wholesale-lora-433mhz-meshtastic.html',
    description: 'מבחר רחב במחירים נמוכים — ודאו בתיאור ההזמנה שנבחר התדר 433MHz.',
  },
];

// A documentation page is not a shop; it is surfaced separately so the store
// grid contains only real shopping destinations.
const isDocsLink = (url = '') => url.includes('meshtastic.org/docs');

const HARDWARE_GUIDE = {
  label: 'רשימת החומרה הנתמכת של Meshtastic',
  url: 'https://meshtastic.org/docs/hardware/devices/',
  description: 'התיעוד הרשמי — כל המכשירים הנתמכים, לפני שמזמינים',
};

export default async function ShopPage() {
  const page = await fetchContent('shop');
  const cmsLinks = (page?.links || []).filter((l) => l.url);
  const cmsShops = cmsLinks.filter((l) => !isDocsLink(l.url));

  // Never show fewer than three shops, whatever the CMS or the API is doing.
  const shops = cmsShops.length >= 3 ? cmsShops : FALLBACK_SHOPS;
  const guide = cmsLinks.find((l) => isDocsLink(l.url)) || HARDWARE_GUIDE;

  return (
    <>
      <PageHero title={page?.title ?? 'ציוד LoRa — זול להפתיע, פשוט להפעלה'} lead={page?.intro} />

      <Section className="pb-0">
        <Alert tone="danger" title="חשוב: תדר 433MHz בלבד">
          בהזמנה בחרו תמיד את גרסת ה-433MHz — התדר החופשי בישראל שבו פועלת רשת דפי-נט.
          מכשיר שהוזמן בגרסת <span className="font-bold">868MHz</span> או{' '}
          <span className="font-bold">915MHz</span> פשוט לא ישתתף ברשת, גם אם הוא זהה בכל דבר אחר.
          בדקו את שדה התדר במפרט ההזמנה לפני התשלום.
        </Alert>
      </Section>

      {/* Sections come from the CMS; links are rendered below so the store grid
          stays under this page's control (fallback + shop/docs separation). */}
      <ContentSections page={page ? { ...page, links: [] } : null} />

      <Section className="pt-0">
        <h3 className="text-xl font-bold text-slate-900">החנויות המומלצות</h3>
        <p className="mt-1 text-sm text-slate-500">
          {shops.length} יעדי רכישה מומלצים — בכולם בחרו את גרסת 433MHz.
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {shops.map((shop) => (
            <Card key={shop.url} className="flex flex-col">
              <h4 className="text-lg font-bold text-slate-900">{shop.label}</h4>
              {shop.description && (
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                  {shop.description}
                </p>
              )}
              <div className="mt-4">
                <Button as="a" href={shop.url} target="_blank" rel="noopener noreferrer">
                  לחנות <span aria-hidden="true">↗</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <a
          href={guide.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-5 block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
        >
          <p className="font-bold text-slate-900 group-hover:text-emerald-700">
            {guide.label}
            <span aria-hidden="true" className="ms-1.5 text-emerald-600">
              ↗
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {guide.description} — תיעוד, לא חנות.
          </p>
        </a>
      </Section>

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
