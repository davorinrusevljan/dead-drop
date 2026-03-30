import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'dead-drop.xyz — Share secrets. Leave no trace.',
  description:
    'Privacy-focused, ephemeral data sharing. End-to-end encrypted drops that self-destruct.',
  keywords: ['privacy', 'encryption', 'ephemeral', 'secure', 'sharing', 'dead drop'],
  authors: [{ name: 'ghostgrammer.xyz' }],
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'dead-drop.xyz',
    description: 'Share secrets. Leave no trace.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
