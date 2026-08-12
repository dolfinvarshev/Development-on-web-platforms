import './globals.css';
import { Heebo } from 'next/font/google';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo' });

export const metadata = {
  title: {
    default: 'דפי-נט | רשת דפיברילטורים חכמה',
    template: '%s | דפי-נט',
  },
  description:
    'מיפוי דפיברילטורים נייחים וניידים בזמן אמת — LoRa, Meshtastic ולוויין MAGNUS. כי כל דקה קובעת.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
