/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for @cloudflare/next-on-pages
  experimental: {
    serverActions: {
      allowedOrigins: ['*.pages.dev', 'dead-drop.xyz', '*.dead-drop.xyz'],
    },
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.dead-drop.xyz',
  },
};

export default nextConfig;
