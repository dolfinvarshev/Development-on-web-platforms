// [F4] Call-center (101) view of a single incident. The server component fetches
// the snapshot; IncidentView keeps it live with polling while the incident is open.
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Alert, Section } from '@/components/ui';
import IncidentView from '@/components/map/IncidentView';
import OfficialChannels from '@/components/OfficialChannels';

export const metadata = {
  title: 'תצוגת מוקד — אירוע',
  description: 'מעקב מוקד 101 אחר אירוע החייאה: מיקום, מתנדב בדרך ומרחק נותר בזמן אמת.',
};

export default async function IncidentPage({ params }) {
  // Next 15: params is a Promise and must be awaited.
  const { id } = await params;
  const data = await apiFetch(`/api/incidents/${id}`, { cache: 'no-store' }).catch(() => null);

  if (!data?.incident) {
    return (
      <Section>
        <Alert tone="danger" title="האירוע לא נמצא">
          ייתכן שהאירוע נמחק או שהקישור שגוי.{' '}
          <Link href="/simulator" className="font-semibold underline">
            חזרה לסימולטור
          </Link>
        </Alert>
        {/* The failure branch is exactly when the official fallback matters most. */}
        <OfficialChannels className="mt-4" />
      </Section>
    );
  }

  return <IncidentView initial={data.incident} />;
}
