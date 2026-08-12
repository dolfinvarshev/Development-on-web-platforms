import { PageHero } from '@/components/ui';
import CprGuide from '@/components/cpr/CprGuide';

export const metadata = {
  title: 'מדריך החייאה מהירה',
  description: 'הצעדים שמצילים חיים עד הגעת צוות מד״א — כולל מטרונום לקצב עיסויים נכון',
};

export default function CprPage() {
  return (
    <>
      <PageHero
        title="מדריך החייאה מהירה"
        lead={'הצעדים שמצילים חיים עד הגעת צוות מד"א — כולל מטרונום לקצב עיסויים נכון'}
      />
      <CprGuide />
    </>
  );
}
