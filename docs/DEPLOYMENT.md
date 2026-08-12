# פריסה לענן — צעד אחר צעד (עלות כוללת: 0$)

כל השירותים ברשימה חינמיים לחלוטין במסלולים בהם אנו משתמשים. סדר הפעולות חשוב:
קודם מסד הנתונים, אחר כך ה-API, ולבסוף האתר.

## שלב 0 — GitHub

1. צרו ריפו חדש ב-GitHub והעלו אליו את הפרויקט:
   ```bash
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```

## שלב 1 — MongoDB Atlas (NoSQL, חינם)

1. הרשמה ב-https://www.mongodb.com/cloud/atlas → צרו Cluster חינמי (M0, אזור קרוב).
2. Database Access → צרו משתמש עם סיסמה.
3. Network Access → Allow access from anywhere ‏(0.0.0.0/0).
4. Connect → Drivers → העתיקו את מחרוזת החיבור (`mongodb+srv://...`) — זה יהיה
   `MONGODB_URI` (החליפו `<password>` בסיסמה שיצרתם, והוסיפו שם DB: `/definet`).

## שלב 2 — Render (שרת ה-Express, חינם)

1. הרשמה ב-https://render.com עם חשבון ה-GitHub → New → Web Service → בחרו את הריפו.
2. הגדרות:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Environment Variables:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | המחרוזת משלב 1 |
   | `ACCESS_TOKEN_SECRET` | מחרוזת אקראית ארוכה (למשל מ-`openssl rand -hex 32`) |
   | `REFRESH_TOKEN_SECRET` | מחרוזת אקראית ארוכה אחרת |
   | `CLIENT_ORIGIN` | כתובת ה-Vercel משלב 3 (אפשר לעדכן אחרי) |
4. Deploy → העתיקו את כתובת השירות (למשל `https://definet-api.onrender.com`).
5. בדיקה: `https://<render-url>/api/health` צריך להחזיר `{"ok":true,...}`.
   בעלייה ראשונה השרת זורע אוטומטית את האדמין ו-50 מכשירי הדמו.

## שלב 3 — Vercel (אתר ה-Next.js, חינם)

1. הרשמה ב-https://vercel.com עם חשבון ה-GitHub → Add New Project → בחרו את הריפו.
2. הגדרות:
   - **Root Directory:** `web`
   - Framework Preset: Next.js (מזוהה אוטומטית)
3. Environment Variables:
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | כתובת ה-Render משלב 2 (בלי `/` בסוף) |
4. Deploy → קיבלתם כתובת (למשל `https://definet.vercel.app`).
5. חזרו ל-Render ועדכנו את `CLIENT_ORIGIN` לכתובת ה-Vercel המדויקת (כולל `https://`,
   בלי `/` בסוף) — זה מאפשר CORS + עוגיית ה-Refresh בין הדומיינים.

## שלב 4 — בדיקות קבלה בענן

- [ ] עמוד הבית נטען בעברית עם הדיאגרמה
- [ ] הרשמה של משתמש חדש עובדת (`/register`)
- [ ] הסימולטור יוצר אירוע, מדרג מועמדים ומצייר מסלול אופניים (`/simulator`)
- [ ] כניסת אדמין `micha`/`1234` עובדת, עריכת תוכן נשמרת ומופיעה באתר (`/admin`)
- [ ] דשבורד האנליטיקה מציג את האירוע שיצרתם (`/admin/analytics`)

## הערות חשובות

- **Render Free נרדם** אחרי ~15 דקות ללא תנועה; הבקשה הראשונה איטית (~30 שנ׳).
  לפני הצגת הפרויקט — פתחו את `/api/health` דקה מראש כדי "להעיר" את השרת.
- **SQLite על Render Free אינו מתמיד** בין Deploys — המערכת נזרעת מחדש אוטומטית
  (מספיק ומצוין לצורכי הדמו וההגנה; מוצהר בשקופית הבעיות הידועות).
- עדכנו את כתובת הענן וה-GitHub ב-README הראשי אחרי הפריסה.
