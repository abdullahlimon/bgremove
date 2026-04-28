import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Snipbg — Free Background Remover',
  description:
    'Remove image backgrounds for free, right in your browser. Replace, blur, resize, and export. No uploads, no accounts, no ads.',
  keywords: ['background remover', 'remove background', 'transparent png', 'free'],
  authors: [{ name: 'Snipbg' }],
  openGraph: {
    title: 'Snipbg — Free Background Remover',
    description: 'Remove image backgrounds for free, right in your browser.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0b0b10',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
