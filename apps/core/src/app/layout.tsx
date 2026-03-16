import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'dead-drop',
  description: 'Privacy-focused, ephemeral data sharing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
