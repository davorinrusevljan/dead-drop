import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamicParams = true;

interface Screenshot {
  slug: string;
  title: string;
  description: string;
  src:
    | '/screenshots/homepage.png'
    | '/screenshots/create-drop-filled.png'
    | '/screenshots/view-drop-landing.png';
  alt: string;
}

const screenshots: Screenshot[] = [
  {
    slug: 'homepage',
    title: 'Homepage',
    description:
      'The dead-drop.xyz landing page features a clean split-panel design. On the left, "Create Drop" with an auto-generated memorable name ready to go. On the right, "View Drop" to access existing drops. No account needed.',
    src: '/screenshots/homepage.png',
    alt: 'dead-drop.xyz homepage showing Create Drop and View Drop panels with auto-generated name',
  },
  {
    slug: 'create-drop',
    title: 'Creating a Drop',
    description:
      'The drop creation flow: enter your secret content, set a passphrase for client-side AES-256-GCM encryption, and click Create. The drop name travels in the URL fragment and is never sent to the server.',
    src: '/screenshots/create-drop-filled.png',
    alt: 'Creating an encrypted drop on dead-drop.xyz — entering content and passphrase',
  },
  {
    slug: 'view-drop',
    title: 'Viewing a Drop',
    description:
      'To view a drop, switch to the View panel and enter the drop name. If encrypted, you will be prompted for the passphrase to decrypt client-side. Content is never exposed to the server.',
    src: '/screenshots/view-drop-landing.png',
    alt: 'View Drop panel on dead-drop.xyz — entering drop name to unlock and view encrypted content',
  },
];

export async function generateStaticParams() {
  return screenshots.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shot = screenshots.find((s) => s.slug === slug);
  if (!shot) return {};
  return {
    title: `${shot.title} — dead-drop.xyz Gallery`,
    description: shot.description,
    openGraph: {
      title: `${shot.title} — dead-drop.xyz`,
      description: shot.description,
      images: [{ url: shot.src, alt: shot.alt }],
    },
  };
}

export default async function ScreenshotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shot = screenshots.find((s) => s.slug === slug);
  if (!shot) notFound();

  const currentIndex = screenshots.findIndex((s) => s.slug === slug);
  const prev = currentIndex > 0 ? screenshots[currentIndex - 1] : null;
  const next = currentIndex < screenshots.length - 1 ? screenshots[currentIndex + 1] : null;

  return (
    <>
      <header className="page-header">
        <Link href="/">dead-drop.xyz</Link>
      </header>
      <main className="main-container" style={{ paddingTop: '2rem' }}>
        <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '56rem' }}>
          {/* Breadcrumb */}
          <nav
            style={{
              fontSize: '0.875rem',
              color: 'var(--fg-muted)',
              marginBottom: '2rem',
            }}
          >
            <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
              Home
            </Link>
            <span style={{ margin: '0 0.5rem' }}>/</span>
            <Link href="/gallery" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
              Gallery
            </Link>
            <span style={{ margin: '0 0.5rem' }}>/</span>
            <span style={{ color: 'var(--fg)' }}>{shot.title}</span>
          </nav>

          {/* Title */}
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
              fontWeight: 700,
              color: 'var(--accent)',
              marginBottom: '1rem',
            }}
          >
            {shot.title}
          </h1>

          {/* Description */}
          <p
            style={{
              color: 'var(--fg-muted)',
              fontSize: '1.0625rem',
              lineHeight: 1.7,
              marginBottom: '2rem',
            }}
          >
            {shot.description}
          </p>

          {/* Image */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              overflow: 'hidden',
              marginBottom: '2rem',
            }}
          >
            <img
              src={shot.src}
              alt={shot.alt}
              style={{
                width: '100%',
                display: 'block',
              }}
            />
          </div>

          {/* Prev/Next navigation */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              borderTop: '1px solid var(--border)',
              paddingTop: '1.5rem',
            }}
          >
            {prev ? (
              <Link
                href={`/gallery/${prev.slug}`}
                style={{
                  textDecoration: 'none',
                  color: 'var(--fg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>← Previous</span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{prev.title}</span>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link
                href={`/gallery/${next.slug}`}
                style={{
                  textDecoration: 'none',
                  color: 'var(--fg)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '0.25rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Next →</span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{next.title}</span>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
        <footer className="footer">
          <nav className="footer-nav">
            <a href="/how-it-works">How It Works</a>
            <a href="/gallery">Gallery</a>
            <a href="/glossary">Glossary</a>
            <a href="/faq">F.A.Q.</a>
            <a href="/terms">Terms of Service</a>
            <a
              href="https://davorinrusevljan.github.io/dead-drop/latest/"
              target="_blank"
              rel="noopener noreferrer"
            >
              API Documentation
            </a>
            <a
              href="https://github.com/davorinrusevljan/dead-drop"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </nav>
          <span style={{ opacity: 0.7 }}>
            ©{' '}
            <a
              href="https://ghostgrammer.xyz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              ghostgrammer.xyz
            </a>
          </span>
        </footer>
      </main>
    </>
  );
}
