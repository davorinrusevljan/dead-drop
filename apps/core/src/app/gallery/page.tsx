import type { Metadata } from 'next';
import Link from 'next/link';
import './gallery.css';

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
        <div className="animate-fade-in-up gallery-container">
          <div className="gallery-header">
            <h1 className="gallery-title">Gallery</h1>
            <p className="gallery-subtitle">See how dead-drop works — from creation to viewing.</p>
          </div>

          <div className="gallery-grid">
            {screenshots.map((shot) => (
              <Link key={shot.slug} href={`/gallery/${shot.slug}`} className="gallery-card">
                <div className="gallery-card-image">
                  <img src={shot.src} alt={shot.title} />
                </div>
                <div className="gallery-card-body">
                  <div className="gallery-card-text">
                    <div className="gallery-card-title">{shot.title}</div>
                    <div className="gallery-card-desc">{shot.description}</div>
                  </div>
                  <span className="gallery-card-arrow">→</span>
                </div>
              </Link>
            ))}
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
