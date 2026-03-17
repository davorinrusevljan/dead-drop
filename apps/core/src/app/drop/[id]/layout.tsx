// Required for Cloudflare Pages - must be in a server component
export const runtime = 'edge';

export default function DropLayout({ children }: { children: React.ReactNode }) {
  return children;
}
