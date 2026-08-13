import { fetchContent } from '@/lib/api';
import { PageHero, Section } from '@/components/ui';
import ContentSections from '@/components/marketing/ContentSections';
import RegisterForm from '@/components/register/RegisterForm';

export const metadata = {
  title: 'הרשמה לרשת',
  description: 'הצטרפות לרשת דפי-נט בשתי דקות — ללא סיסמה, ללא התחייבות.',
};

export default async function RegisterPage({ searchParams }) {
  // Next 15: searchParams is a Promise and must be awaited.
  const [{ category }, page] = await Promise.all([searchParams, fetchContent('register')]);

  return (
    <>
      {/* Requirement 12: the registration page's marketing copy is CMS-managed
          (admin-editable) with hardcoded fallbacks for API outages. */}
      <PageHero
        title={page?.title ?? 'הרשמה לרשת דפי-נט'}
        lead={
          page?.intro ??
          'ההרשמה אורכת כשתי דקות: ללא סיסמה, ללא התחייבות — רק פרטים שמצילים חיים.'
        }
      />
      <Section>
        <RegisterForm initialCategory={category} />
      </Section>
      {page?.sections?.length > 0 && <ContentSections page={page} />}
    </>
  );
}
