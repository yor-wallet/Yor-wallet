import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource-variable/readex-pro/index.css';
import '@fontsource-variable/inter/index.css';
import './globals.css';
import { Providers } from '@/components/shell';

/* iPhone launch screens rendered by tools/brand (css width, css height, pixel ratio) */
const LAUNCH: [number, number, number][] = [[430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2]];

export const metadata: Metadata = {
  title: { default: 'سلفه | SULFA', template: '%s · SULFA' },
  description: 'SULFA — سلفه : demandes de financement en ligne en Oman, suivies et décidées par un administrateur.',
  manifest: '/manifest.webmanifest',
  applicationName: 'SULFA سلفه',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/favicon-64.png', sizes: '64x64', type: 'image/png' }], apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }] },
  appleWebApp: { capable: true, title: 'سلفه', statusBarStyle: 'default', startupImage: LAUNCH.map(([w, h, r]) => ({ url: `/brand/launch-${w * r}x${h * r}.jpg`, media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)` })) },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f7f9f8' }, { media: '(prefers-color-scheme: dark)', color: '#04211b' }] };

/* applies the saved language / theme before the first paint (no flash of the wrong direction) */
const BOOT = `try{var l=localStorage.getItem('sulfa_lang');if(l==='fr'||l==='en'){document.documentElement.lang=l;document.documentElement.dir='ltr'}if(localStorage.getItem('sulfa_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: BOOT }} /></head>
      <body><div aria-hidden className="aurora"><i /><i /><i /></div><a href="#main" className="skip">↓</a><Providers>{children}</Providers></body>
    </html>
  );
}
