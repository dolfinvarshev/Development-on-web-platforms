// [F6] Admin panel — login, dashboard, CMS editor, volunteers DB, alerts, simulator config.
// Spec: docs/ARCHITECTURE.md §8 (/admin).
import AdminApp from '@/components/admin/AdminApp';

export const metadata = {
  title: 'ניהול',
  description: 'לוח הבקרה של דפי-נט — ניהול תוכן, מתנדבים, התראות והגדרות הסימולטור',
  robots: { index: false },
};

export default function AdminPage() {
  return <AdminApp />;
}
