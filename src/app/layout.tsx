import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/lib/providers';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap', weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: { default: 'Carevanta', template: '%s · Carevanta' },
  description: 'Find verified doctors, book lab tests, order medicines and reach ambulances near you.',
  applicationName: 'Carevanta',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Carevanta' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1E6CFF' };

/**
 * Runs before first paint: marks <html> when a session is stored so the CSS can
 * show the "restoring" splash instead of a signed-out header while auth loads.
 * AuthProvider keeps the attribute in sync afterwards.
 */
const SESSION_HINT = "try{if(localStorage.getItem('carevanta.refreshToken'))document.documentElement.dataset.session='1'}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The pre-paint script may add data-session to <html>; that is expected, not a mismatch.
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SESSION_HINT }} />
      </head>
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
