import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { BotProvider } from '@/components/BotProvider';
import { ChatBot } from '@/components/bot/ChatBot';
import { Toast } from '@/components/Toast';
import { site } from '@/data/content';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['SOFT', 'opsz'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Vancouver House Party — Live music for your home',
  description:
    'Handpicked live musicians for private house parties across Vancouver. We specialize in house parties: milestone birthdays, anniversaries and seasonal evenings at home.',
  openGraph: {
    title: 'Vancouver House Party',
    description: 'Live music for Vancouver house parties.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#FAF7F2',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <BotProvider>
          {children}
          <ChatBot />
          <Toast />
        </BotProvider>
      </body>
    </html>
  );
}
