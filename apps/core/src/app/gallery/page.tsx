import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Gallery — dead-drop.xyz',
  description: 'Screenshots of dead-drop.xyz — see how to create, view, and share encrypted drops.',
};

const screenshots = [
  {
    slug: 'homepage',
    title: 'Homepage',
    description:
      'The landing page with Create Drop and View Drop panels. A unique name is auto-generated and ready to use.',
    src: '/screenshots/homepage.png',
  },
  {
    slug: 'create-drop',
    title: 'Creating a Drop',
    description:
      'Enter a drop name via the URL fragment, set visibility (private or public), choose a passphrase, and add your content.',
    src: '/screenshots/create-drop-filled.png',
  },
  {
    slug: 'view-drop',
    title: 'Viewing a Drop',
    description:
      'Click "View Drop" on the homepage, enter the drop name, and unlock with your passphrase to see the decrypted content.',
    src: '/screenshots/view-drop-landing.png',
  },
];

export default function GalleryPage() {
  return (
    <>
      <header className="page-header">
        <Link href="/">dead-drop.xyz</Link>
      </header>
      <main className="main-container" style={{ paddingTop: '2rem' }}>
        <div className="animate-fade-in-up" style={{ width: '100%' }}>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              fontWeight: 700,
              color: 'var(--accent)',
              textAlign: 'center',
              marginBottom: '0.5rem',
            }}
          >
            Gallery
          </h1>
          <p
            style={{
              textAlign: 'center',
              color: 'var(--fg-muted)',
              marginBottom: '3rem',
              fontSize: '1.125rem',
            }}
          >
            See how dead-drop works — from creation to viewing.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '2rem',
              maxWidth: '1200px',
              margin: '0 auto',
            }}
          >
            {screenshots.map((shot) => (
              <Link
                key={shot.slug}
                href={`/gallery/${shot.slug}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s, transform 0.2s',
                }}
                className="gallery-card"
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16/10',
                    overflow: 'hidden',
                    background: 'var(--bg)',
                  }}
                >
                  <img
                    src={shot.src}
                    alt={shot.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'top',
                    }}
                  />
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <h2
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: 'var(--fg)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {shot.title}
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
                    {shot.description}
                  </p>
                </div>
              </Link>
            ))}
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
