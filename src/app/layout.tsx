import type { Metadata, Viewport } from 'next';
import './globals.css';
import { registerServiceWorker } from '@/lib/serviceWorkerRegistration';

export const metadata: Metadata = {
  title: 'SCA-QR · Control de Ingreso',
  description: 'Sistema de Control de Asistencia Escolar con códigos QR - Demo PWA',
  manifest: '/manifest.json',
  applicationName: 'SCA-QR',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SCA-QR',
  },
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-192.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0288d1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `(${registerServiceWorker.toString()})();`,
          }}
        />
      </body>
    </html>
  );
}
