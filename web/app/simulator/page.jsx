// [F4] Distress simulator — thin server component; the whole interactive demo
// lives in the client SimulatorApp (docs/ARCHITECTURE.md §8).
import SimulatorApp from '@/components/map/SimulatorApp';

export const metadata = {
  title: 'סימולטור קריאת מצוקה',
  description:
    'הדגמה חיה מקצה לקצה: קריאת מצוקה, איתור הדפיברילטורים הקרובים, הזנקה היברידית (סלולר + LoRa) ומסלול אופניים אמיתי עד לנקודת האירוע.',
};

export default function SimulatorPage() {
  return <SimulatorApp />;
}
