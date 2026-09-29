import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'CarnIA — Conduce mejor que tus colegas',
  description: 'Test del carnet DGT, pero competitivo. Reta a tus amigos en tiempo real.',
};

export const viewport: Viewport = {
  themeColor: '#07091a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
