import { PageHero, Section } from '@/components/ui';
import RegisterForm from '@/components/register/RegisterForm';

export const metadata = {
  title: 'הרשמה לרשת',
  description: 'הצטרפות לרשת דפי-נט בשתי דקות — ללא סיסמה, ללא התחייבות.',
};

export default async function RegisterPage({ searchParams }) {
  // Next 15: searchParams is a Promise and must be awaited.
  const { category } = await searchParams;

  return (
    <>
      <PageHero
        title="הרשמה לרשת דפי-נט"
        lead="ההרשמה אורכת כשתי דקות: ללא סיסמה, ללא התחייבות — רק פרטים שמצילים חיים."
      />
      <Section>
        <RegisterForm initialCategory={category} />
      </Section>
    </>
  );
}
