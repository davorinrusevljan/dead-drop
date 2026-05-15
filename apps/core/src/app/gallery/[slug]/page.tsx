import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../gallery.css';

export const dynamicParams = true;

interface Screenshot {
  slug: string;
  title: string;
  description: string;
  src: string;
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
        <div className="animate-fade-in-up gallery-container">
          {/* Breadcrumb */}
          <div className="gallery-breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/gallery">Gallery</Link>
            <span>/</span>
            <span style={{ color: 'var(--fg)' }}>{shot.title}</span>
          </div>

          {/* Title */}
          <h1 className="gallery-detail-title">{shot.title}</h1>

          {/* Description */}
          <p className="gallery-detail-desc">{shot.description}</p>

          {/* Image */}
          <div className="gallery-detail-image">
            <img src={shot.src} alt={shot.alt} />
          </div>

          {/* Prev/Next navigation */}
          <div className="gallery-nav">
            {prev ? (
              <Link href={`/gallery/${prev.slug}`} className="gallery-nav-link">
                <span className="gallery-nav-label">← Previous</span>
                <span className="gallery-nav-title">{prev.title}</span>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link href={`/gallery/${next.slug}`} className="gallery-nav-link next">
                <span className="gallery-nav-label">Next →</span>
                <span className="gallery-nav-title">{next.title}</span>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
      </main>
      <footer className="footer">
        <nav className="footer-nav">
          <Link href="/">Home</Link>
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/gallery">Gallery</Link>
          <Link href="/glossary">Glossary</Link>
          <Link href="/faq">F.A.Q.</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link
            href="https://davorinrusevljan.github.io/dead-drop/latest/"
            target="_blank"
            rel="noopener noreferrer"
          >
            API Documentation
          </Link>
          <Link
            href="https://github.com/davorinrusevljan/dead-drop"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
        </nav>
        <p style={{ marginTop: '1rem', opacity: 0.7 }}>
          ©{' '}
          <a
            href="https://ghostgrammer.xyz"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit' }}
          >
            ghostgrammer.xyz
          </a>
        </p>
      </footer>
    </>
  );
}
