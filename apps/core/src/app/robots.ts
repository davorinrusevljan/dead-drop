import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/drop/', // Individual drop pages (ephemeral, privacy-focused)
      ],
    },
    sitemap: 'https://dead-drop.xyz/sitemap.xml',
  };
}
