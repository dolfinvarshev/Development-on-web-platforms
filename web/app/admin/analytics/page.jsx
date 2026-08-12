// [F7] Admin analytics — thin server component; all interactivity lives in the
// client dashboard (docs/ARCHITECTURE.md §8).
import AnalyticsDashboard from '@/components/admin-analytics/AnalyticsDashboard';

export const metadata = {
  title: 'אנליטיקת זמני תגובה',
  description: 'ניתוח זמני אישור והגעה של מתנדבים לאירועי החייאה — לוח מחוונים למנהלים.',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
