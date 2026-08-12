'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Section } from '@/components/ui';
import { startMetronome, stopMetronome } from '@/lib/sound';

const BPM = 110;
const BEAT_SECONDS = 60 / BPM; // one compression per beat → CSS animations sync to the audio

const STEPS = [
  {
    title: 'בדקו הכרה ונשימה',
    body: 'טלטלו בעדינות וקראו בקול. אין תגובה ואין נשימה תקינה — מתחילים החייאה מיד.',
  },
  {
    title: 'חייגו 101 ושלחו להביא דפיברילטור',
    body: (
      <>
        שלחו מישהו להביא את הדפיברילטור הקרוב —{' '}
        <Link href="/simulator" className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
          הראו לו את המפה שלנו
        </Link>
        .
      </>
    ),
  },
  {
    title: 'עיסויי חזה',
    body: 'מרכז החזה, ידיים ישרות, עומק 5–6 ס״מ, קצב 100–110 לדקה. אל תפחדו ללחוץ חזק.',
  },
  {
    title: 'יחס 30:2',
    body: '30 עיסויים ואז 2 הנשמות — מיומנים בלבד; אחרת ממשיכים בעיסויים רצופים ללא הפסקה.',
  },
  {
    title: 'הפעילו את הדפיברילטור ברגע שהגיע',
    body: 'הדליקו אותו ופעלו לפי ההנחיות הקוליות. הדביקו את המדבקות על חזה חשוף, והתרחקו מהנפגע בזמן מתן השוק.',
  },
  {
    title: 'אל תפסיקו',
    body: 'המשיכו עד הגעת צוות מד״א או עד שהנפגע מגיב.',
  },
];

const AED_POINTS = [
  'המכשיר מנתח את קצב הלב בעצמו ומחליט לבד אם נדרש שוק — אי אפשר להזיק בלחיצה על הכפתור.',
  'פתחו אותו ופעלו לפי ההנחיות הקוליות בעברית, שלב אחר שלב.',
  'הדביקו את המדבקות על חזה חשוף ויבש, והמשיכו בעיסויים בין ההנחיות.',
];

function formatElapsed(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 shrink-0" aria-hidden="true">
      <path d="M6.6 2.8c.6-.6 1.6-.5 2.1.2l2 2.8c.4.6.4 1.4-.1 1.9l-1.2 1.2a.9.9 0 0 0-.1 1.1 14.4 14.4 0 0 0 4.7 4.7c.3.2.8.2 1.1-.1l1.2-1.2c.5-.5 1.3-.6 1.9-.1l2.8 2c.7.5.8 1.5.2 2.1l-1.3 1.3c-.7.7-1.7 1-2.7.7-2.9-.8-5.7-2.5-8.2-5s-4.2-5.3-5-8.2c-.3-1 0-2 .7-2.7l1.9-1.7z" />
    </svg>
  );
}

function HeartIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 21.3 4.8 14a5.6 5.6 0 0 1 0-7.9 5.4 5.4 0 0 1 7.2-.4 5.4 5.4 0 0 1 7.2.4 5.6 5.6 0 0 1 0 7.9L12 21.3z" />
    </svg>
  );
}

export default function CprGuide() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  // If the volunteer navigates away mid-compression, the beeps must not keep playing.
  useEffect(() => () => stopMetronome(), []);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [running]);

  function toggleMetronome() {
    if (running) {
      stopMetronome();
      setRunning(false);
    } else {
      startRef.current = Date.now();
      setElapsed(0);
      startMetronome(BPM);
      setRunning(true);
    }
  }

  return (
    <div className="pb-16">
      {/* The button-scale keyframe lives here (not in tailwind.config) because its duration is bound to BPM at runtime. */}
      <style>{`
        @keyframes cpr-beat {
          0% { transform: scale(1); }
          35% { transform: scale(0.86); }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>

      <Section className="pb-0">
        <Alert tone="danger" className="text-base">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <PhoneIcon />
              <p>
                <span className="font-bold">לפני הכל — חייגו 101 והפעילו רמקול.</span>{' '}
                מוקדן מד״א ילווה אתכם בכל שלב.
              </p>
            </div>
            <Button as="a" href="tel:101" variant="emergency" className="shrink-0 px-6 text-base">
              חיוג 101
            </Button>
          </div>
        </Alert>
      </Section>

      <Section title="שישה צעדים שמצילים חיים" className="pb-4">
        <ol className="max-w-3xl space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="flex items-start gap-5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600 text-3xl font-black text-white">
                  {index + 1}
                </span>
                <div className="pt-1">
                  <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-lg leading-relaxed text-slate-600">{step.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="מטרונום עיסויים" subtitle="קשה לשמור על קצב נכון בלחץ. הפעילו את המטרונום ולחצו על החזה עם כל צליל." className="pb-4">
        <Card className="max-w-3xl overflow-hidden py-10">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="relative flex items-center justify-center p-6">
              {running && (
                <span
                  className="animate-pulse-ring absolute inset-6 rounded-full bg-red-400"
                  style={{ animationDuration: `${BEAT_SECONDS}s` }}
                  aria-hidden="true"
                />
              )}
              <Button
                variant="emergency"
                onClick={toggleMetronome}
                aria-pressed={running}
                className="relative h-44 w-44 flex-col rounded-full text-2xl font-extrabold shadow-lg"
                style={running ? { animation: `cpr-beat ${BEAT_SECONDS}s ease-in-out infinite` } : undefined}
              >
                <HeartIcon className="h-10 w-10" />
                {running ? 'עצור' : 'התחל קצב'}
              </Button>
            </div>

            <div>
              <p className="text-xl font-bold text-slate-900">110 לחיצות בדקה</p>
              <p className="mt-1 text-sm text-slate-500">
                {running ? 'עיסוי אחד על כל צליל — בעומק 5–6 ס״מ' : 'לחיצה על העיגול מתחילה את הצלילים'}
              </p>
            </div>

            {running && (
              <div className="rounded-xl bg-slate-50 px-8 py-4">
                <span dir="ltr" className="block text-3xl font-extrabold tabular-nums text-slate-900">
                  {formatElapsed(elapsed)}
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  זמן מתחילת העיסויים — אם יש עוד אדם, התחלפו כל 2 דקות
                </p>
              </div>
            )}
          </div>
        </Card>
      </Section>

      <Section title="הדפיברילטור (AED)" className="pb-4">
        <Card className="max-w-3xl">
          <h3 className="text-lg font-bold text-slate-900">
            אל תחששו מהמכשיר — הוא לא ייתן שוק אלא אם צריך
          </h3>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-slate-600 leading-relaxed">
            {AED_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Card>
      </Section>

      {/* pt-2/pb-0 (not py-*) so they actually override the Section base py-10 in Tailwind's cascade */}
      <Section className="pt-2 pb-0">
        <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
          מדריך תמציתי למצב חירום, על פי עקרונות מד״א וה־ERC (המועצה האירופית להחייאה). הוא אינו
          תחליף לקורס החייאה מוסמך — מומלץ להירשם ל
          <a
            href="https://www.mdais.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
          >
            קורסי החייאה של מד״א
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
