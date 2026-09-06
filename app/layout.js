import { Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { APP, FIRM } from '@/lib/config';
import { THEME_BOOTSTRAP } from '@/lib/theme';

// Self-hosted through next/font, which also removes the render-blocking
// Google Fonts <link> the catalogue currently carries.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata = {
  // Chrome says SoSell; paperwork says Patel Marketing.
  title: { default: APP.name, template: `%s · ${APP.name}` },
  description: `${FIRM.legalName} — ${FIRM.trade.toLowerCase()}, wholesale and collection in one place.`,
  manifest: '/manifest.webmanifest',
  applicationName: APP.name,
  appleWebApp: { capable: true, title: APP.name, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // so safe-area insets actually have something to inset from
};

export default function RootLayout({ children }) {
  return (
    // data-theme and data-mode are stamped by the bootstrap below, before
    // first paint. suppressHydrationWarning because the client legitimately
    // knows something the server does not: what this reader chose last time.
    <html
      lang="en"
      data-theme="sky"
      data-mode="light"
      className={`${inter.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
