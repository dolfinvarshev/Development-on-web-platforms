import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="font-bold text-red-700">
            במקרה חירום אמיתי חייגו מיד <a href="tel:101" className="underline">101</a> — מגן דוד אדום
          </p>
          <p className="mt-1 text-sm text-red-600">
            דפי-נט הוא פרויקט לימודי ואינו תחליף לשירותי החירום הרשמיים.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h3 className="mb-3 font-bold text-slate-900">דפי-נט</h3>
            <p className="text-sm leading-relaxed text-slate-500">
              רשת דפיברילטורים חכמה: מיפוי מכשירים נייחים וניידים בזמן אמת באמצעות סלולר,
              LoRa (Meshtastic) ולוויין MAGNUS.
            </p>
          </div>
          <div>
            <h3 className="mb-3 font-bold text-slate-900">מפות רשמיות</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://www.mdais.org/about/mdefi" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                  מאגר הדפיברילטורים הלאומי של מד״א
                </a>
              </li>
              <li>
                <a href="https://defi.co.il/#/map" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                  Where is Defi — מפת דפיברילטורים
                </a>
              </li>
              <li>
                <a href="https://meshtastic.org" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                  Meshtastic — האתר הרשמי
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-bold text-slate-900">קישורים מהירים</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/register" className="text-emerald-700 hover:underline">הרשמה לרשת</Link></li>
              <li><Link href="/simulator" className="text-emerald-700 hover:underline">סימולטור קריאת מצוקה</Link></li>
              <li><Link href="/cpr" className="text-emerald-700 hover:underline">מדריך החייאה</Link></li>
              <li><Link href="/admin" className="text-slate-500 hover:underline">כניסת מנהל</Link></li>
            </ul>
          </div>
        </div>

        <p className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
          פרויקט קורס «פיתוח בסביבות WEB» · Next.js + Express + SQLite + MongoDB · LoRa 433MHz
        </p>
      </div>
    </footer>
  );
}
