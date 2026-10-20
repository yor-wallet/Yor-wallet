import type { Metadata, Viewport } from 'next';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import '@fontsource/tajawal/900.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource-variable/inter/index.css';
import './globals.css';
import { Providers } from '@/components/shell';

export const metadata: Metadata = {
  title: { default: 'سلفه | SULFA', template: '%s · SULFA' },
  description: 'SULFA — سلفه : demandes de financement en ligne en Oman, suivies et décidées par un administrateur.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'SULFA', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f7f9f8' }, { media: '(prefers-color-scheme: dark)', color: '#04211b' }] };

/* applies the saved language / theme before the first paint (no flash of the wrong direction) */
const BOOT = `try{var l=localStorage.getItem('sulfa_lang');if(l==='fr'||l==='en'){document.documentElement.lang=l;document.documentElement.dir='ltr'}if(localStorage.getItem('sulfa_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: BOOT }} /></head>
      <body><a href="#main" className="skip">↓</a><Providers>{children}</Providers></body>
    </html>
  );
}
