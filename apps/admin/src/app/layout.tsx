import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admin Panel | dead-drop.xyz',
  description: 'Admin dashboard for dead-drop.xyz',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0f] text-zinc-200 antialiased">{children}</body>
    </html>
  );
}
