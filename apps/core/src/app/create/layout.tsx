import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/create' },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
