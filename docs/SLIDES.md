# מצגת ההגנה — דפי-נט (DefiNet)

> תוכן מוכן להעתקה לשקפים (PowerPoint / Google Slides). מבנה השקפים לפי דרישות ההגשה.

---

## שקף 1 — פרטי הפרויקט

**דפי-נט (DefiNet) — רשת דפיברילטורים חכמה**
פרויקט בקורס «פיתוח בסביבות WEB»

- **מבצעים:** _[שם שותף 1]_ · _[שם שותף 2]_
- **GitHub:** _[https://github.com/<user>/<repo>]_
- **כתובת בענן:** _[https://<app>.vercel.app]_ (API: _[https://<api>.onrender.com]_)
- **כניסת מנהל להדגמה:** `micha` / `1234`

---

## שקף 2 — בעיות ידועות (גילוי נאות)

> גילוי מלא — בעיות שהתגלו בהגנה ללא הצהרה כאן יורידו ניקוד משמעותית.

1. **Render Free "נרדם"** אחרי ~15 דק׳ חוסר פעילות — הבקשה הראשונה לשרת ה-API איטית (~30 שנ׳).
   מעקף להדגמה: פותחים את `/api/health` דקה מראש כדי "להעיר" את השרת.
2. **SQLite בענן החינמי אינו מתמיד** בין פריסות — בכל Deploy מחדש הנתונים נזרעים מחדש
   (50 מכשירי הדמו חוזרים; הרשמות אמת בענן נשמרות עד ה-Deploy הבא). מקומית הכול נשמר.
3. **MongoDB בזיכרון בפיתוח מקומי** מתאפס בהפעלה מחדש של השרת (תוכן ה-CMS נזרע מחדש).
   בענן משתמשים ב-MongoDB Atlas מתמיד.
4. **שירות הניתוב** (OSRM ציבורי, חינמי) תלוי בצד-שלישי; בעת כשל מוצג קו מסלול משוער והודעה.
5. **SMS/Push אמיתיים אינם נשלחים** — הם מדומים בסימולטור ומתועדים ביומן ההתראות
   (שליחת SMS אמיתית אינה חינמית ואינה נדרשת בפרויקט לימודי זה).

---

## שקף 3 — ארכיטקטורה

```
דפדפן ──► Next.js 15 + Tailwind  (Vercel · פורט 3000)
              │  שיווק (CMS) · סימולטור (Leaflet) · פאנל ניהול · אנליטיקה
              ▼  fetch + CORS + עוגיית Refresh
          Express  (Render · פורט 4000) — REST API
              │  JWT + Refresh Rotation · מנוע אירועים · Geo-fencing
              ├──► SQLite  (SQL)   — users · devices · admins · refresh_tokens
              └──► MongoDB (NoSQL) — incidents · content · alerts · telemetry · config
```

- **שני שרתים:** Next.js (הגשת UI ו-SSR) + Express (הרשאות ולוגיקה) — אחד מהם Express עם JWT refresh.
- **שני מסדי נתונים:** SQL לנתונים טבלאיים עם קשרים ואילוצים; NoSQL למסמכי אירוע עשירים ותוכן גמיש.
- **שלושה ערוצי מיקום:** סלולר · LoRa 433MHz (Meshtastic) · לוויין MAGNUS (Iridium) — עדיפות ל-MAGNUS.

---

## שקף 4 — דוגמה: מנוע האירועים (Geo-fencing + דירוג)

קטע הליבה מ-`server/src/routes/incidents.js` — מה שקורה בכל קריאת מצוקה:

```js
// 1. פיזור אקראי של כל 50 המכשירים סביב האירוע (דרישה 9)
const scattered = rows.map((row) => {
  const pos = scatterAround(lat, lng, radiusM * cfg.scatterFactor);
  const distanceM = haversineM(lat, lng, pos.lat, pos.lng);
  return { row, pos, distanceM, inRadius: distanceM <= radiusM, ... };
});
// 2. דירוג: בתוך הרדיוס תחילה, שידור טרי לפני ישן, ואז המרחק הקצר ביותר
const sorted = scattered.filter((s) => s.row.has_defib === 1).sort((a, b) => {
  if (a.inRadius !== b.inRadius) return a.inRadius ? -1 : 1;
  if (a.fresh   !== b.fresh)     return a.fresh   ? -1 : 1;
  return a.distanceM - b.distanceM;
});
```

**נקודות להגנה:** נוסחת haversine ומעבר מטרים→מעלות; פיזור אחיד בדיסק (`r = R·√U`);
מיון יציב בשלושה מפתחות; רק מועמדים בתוך הרדיוס מקבלים דירוג והזנקה.

---

## שקף 5 — דוגמה: JWT עם Refresh Rotation

מ-`server/src/routes/auth.js` — כל טוקן רענון הוא חד-פעמי:

```js
router.post('/refresh', (req, res) => {
  const session = verifyRefreshCookie(req);          // JWT + שורת jti חיה ב-DB
  if (!session) return res.status(401).json({ error: 'unauthorized' });
  db.transaction(() => {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?').run(session.jti);
    issueRefreshToken(res, session.username);         // jti חדש + עוגייה חדשה
  })();
  res.json({ accessToken: signAccessToken(session.username) });
});
```

**נקודות להגנה:** Access token קצר (15 דק׳, בזיכרון) מול Refresh ארוך (7 ימים, עוגיית httpOnly);
רוטציה → עוגייה גנובה מתה בשימוש חוזר; בצד הלקוח `refreshAccessToken` הוא single-flight
כדי שקריאות מקבילות לא יפילו את הסשן.

---

## שקף 6 — דוגמה: ההזנקה ההיברידית + הסימולטור

מ-`server/src/routes/incidents.js` — שני ערוצים במקביל לכל מועמד בתוך הרדיוס:

```js
logs.push({ type: 'incident_push', ... });                 // סלולר: Push
logs.push({ type: 'incident_sms',  ... });                 // סלולר: SMS (שם, טלפון, מיקום)
if (c.hasLora) logs.push({ type: 'incident_lora_downlink', ... }); // LoRa: צפצוף + הבהוב
```

בצד הלקוח (`web/components/map/SimulatorApp.jsx`): ניקוד המסלול נעשה מול **OSRM cycling**
(מסלול אופניים אמיתי, דרישה 10), המתנדב מונפש לאורך המסלול, ופירורי-לחם נשלחים למוקד כל 2 שנ׳.

**מדדים להגנה:** 100% כיסוי דרישות · שני מסדי נתונים · שני שרתים · שתי תוספות בונוס
(מסך החייאה עם מטרונום 110BPM, דשבורד אנליטיקת זמני תגובה).
