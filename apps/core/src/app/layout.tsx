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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebAPI',
              name: 'dead-drop',
              description: 'Privacy-focused, ephemeral zero-knowledge encrypted data sharing API',
              url: 'https://api.dead-drop.xyz',
              documentation: 'https://api.dead-drop.xyz/api/v1/docs',
              termsOfService: 'https://dead-drop.xyz/terms',
              license: 'https://github.com/davorinrusevljan/dead-drop/blob/main/LICENSE',
              provider: {
                '@type': 'Organization',
                name: 'dead-drop.xyz',
                url: 'https://dead-drop.xyz',
              },
              offers: {
                '@type': 'Offer',
                description: 'Free tier: 10KB, 7-day expiry, no API key needed',
                price: '0',
                priceCurrency: 'USD',
              },
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
