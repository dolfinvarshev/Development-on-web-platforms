import Link from 'next/link';
import { fetchContent } from '@/lib/api';
import { Badge, Button, Card, PageHero, Section } from '@/components/ui';
import ContentSections from '@/components/marketing/ContentSections';

export const metadata = { title: 'הצטרפות לרשת' };

// The three eligibility tracks (requirement 8) — each leads to the registration
// form with its category pre-selected via the query string.
const JOIN_PATHS = [
  {
    emoji: '🫀',
    category: 'defib_lora',
    title: 'בעלי דפיברילטור + משדר LoRa',
    body: 'אנחנו מצמידים משדר LoRa קטן לדפיברילטור שלכם, והוא מדווח את מיקומו אוטומטית — גם היכן שאין קליטה סלולרית. הדפיברילטור שלכם מצטרף למפת ההצלה הארצית ומשמש בעצמו ממסר ברשת.',
  },
  {
    emoji: '📱',
    category: 'defib_only',
    title: 'בעלי דפיברילטור נייד — טלפון בלבד',
    body: 'הצטרפות מיידית בלי שום חומרה נוספת: הטלפון מדווח את מיקום הדפיברילטור כשיש קליטה, ואתם מקבלים הזנקה כשאתם הקרובים ביותר לאירוע.',
  },
  {
    emoji: '🔁',
    category: 'lora_only',
    title: 'נושאי LoRa ללא דפיברילטור',
    grant: true,
    body: 'הפכו לממסר שמרחיב את רשת ההצלה: מכשיר ה-LoRa שאתם נושאים מעביר הודעות מצוקה ברשת ה-Mesh ומרחיב את הכיסוי לאזורים ללא קליטה — גם בלי דפיברילטור.',
  },
];

export default async function JoinPage() {
  const page = await fetchContent('join');
  return (
    <>
      <PageHero title={page?.title ?? 'הצטרפו לרשת — ומקבלים 50$'} lead={page?.intro} />

      <Section className="pb-0">
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Badge color="emerald" className="px-3 py-1 text-sm">
            50$
          </Badge>
          <p className="font-semibold text-slate-800">
            מצטרפים חדשים שמשמשים ממסרי רשת מקבלים מענק של 50$
          </p>
        </Card>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {JOIN_PATHS.map((path) => (
            <Card key={path.category} className="flex flex-col">
              <span aria-hidden="true" className="text-3xl">
                {path.emoji}
              </span>
              <h3 className="mt-3 text-lg font-bold text-slate-900">{path.title}</h3>
              {path.grant && (
                <div className="mt-2">
                  <Badge color="emerald">זכאות למענק 50$</Badge>
                </div>
              )}
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{path.body}</p>
              <Button as={Link} href={`/register?category=${path.category}`} className="mt-5 w-full">
                הרשמה במסלול זה
              </Button>
            </Card>
          ))}
        </div>
      </Section>

      <ContentSections page={page} />
    </>
  );
}
