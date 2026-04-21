import Link from 'next/link';
import './glossary.css';

interface GlossaryItem {
  term: string;
  definition: string;
  category: 'core' | 'security' | 'tier' | 'crypto';
}

const glossaryItems: GlossaryItem[] = [
  // Core Terms
  {
    term: 'Drop',
    definition:
      'An ephemeral container for text content. Each drop has a unique name, optional password protection, and an expiration date. Drops are identified by their name, not by user accounts.',
    category: 'core',
  },
  {
    term: 'Drop Name',
    definition:
      'A URL-safe identifier for a drop (e.g., "my-secret-project"). Names are normalized to lowercase with hyphens replacing spaces. Standard drops require 12+ characters.',
    category: 'core',
  },
  {
    term: 'Drop Password',
    definition:
      'The secret string used to encrypt (private) or authenticate (public) a drop. For private drops, this password derives the encryption key. Choose strong, memorable passwords.',
    category: 'core',
  },
  {
    term: 'Fragment Routing',
    definition:
      'Using URL fragments (#name) instead of paths (/drop/name) for drop access. Fragments are never sent to the server, ensuring the drop name never appears in logs or DNS records.',
    category: 'core',
  },
  // Security Terms
  {
    term: 'Zero-Knowledge',
    definition:
      'A security model where the server has no knowledge of the plaintext content. For private drops, encryption happens client-side; the server only stores ciphertext and cannot decrypt it.',
    category: 'security',
  },
  {
    term: 'Client-Side Encryption',
    definition:
      'Encryption that occurs in your browser before data is sent to the server. Your password never leaves your device. The server receives only encrypted data it cannot read.',
    category: 'security',
  },
  {
    term: 'Ephemeral',
    definition:
      'Designed to be temporary. Standard drops have a 7-day lifespan. Deletion is not necessarily immediate and may occur later. In the future, we may introduce longer-lasting drop types.',
    category: 'security',
  },
  // Tier Terms
  {
    term: 'Standard Drop',
    definition:
      'Free tier drop: max 10KB, text only, 7-day lifespan, requires 12+ character name. Perfect for sharing code snippets, credentials, or short messages.',
    category: 'tier',
  },
  {
    term: 'Private Drop',
    definition:
      'Content is encrypted client-side. Password required to read, edit, or delete. Server sees only encrypted data. Maximum privacy.',
    category: 'tier',
  },
  {
    term: 'Public Drop',
    definition:
      'Content is stored as plaintext. Anyone with the URL can read it. Password required only to edit or delete. Good for non-sensitive shared information.',
    category: 'tier',
  },
  // Crypto Terms
  {
    term: 'AES-256-GCM',
    definition:
      'Advanced Encryption Standard with 256-bit keys in Galois/Counter Mode. The encryption algorithm used for private drops. Provides both confidentiality and integrity verification.',
    category: 'crypto',
  },
  {
    term: 'PBKDF2',
    definition:
      'Password-Based Key Derivation Function 2. Used to convert your password into an encryption key. We use 100,000 iterations with SHA-256 to make brute-force attacks impractical.',
    category: 'crypto',
  },
  {
    term: 'SHA-256',
    definition:
      'Secure Hash Algorithm with 256-bit output. Used for generating drop IDs from names and hashing admin passwords. One-way function: cannot be reversed.',
    category: 'crypto',
  },
  {
    term: 'Salt',
    definition:
      'Random data added to a password before hashing or key derivation. Prevents rainbow table attacks and ensures identical passwords produce different encrypted outputs.',
    category: 'crypto',
  },
  {
    term: 'IV (Initialization Vector)',
    definition:
      'A random value used alongside the key for AES encryption. Ensures that encrypting the same content twice produces different ciphertext. 12 bytes for AES-GCM.',
    category: 'crypto',
  },
];

const categoryLabels: Record<GlossaryItem['category'], string> = {
  core: 'Core Concepts',
  security: 'Security',
  tier: 'Drop Types',
  crypto: 'Cryptography',
};

const categoryOrder: GlossaryItem['category'][] = ['core', 'tier', 'security', 'crypto'];

export default function GlossaryPage() {
  const groupedItems = categoryOrder.reduce(
    (acc, category) => {
      acc[category] = glossaryItems.filter((item) => item.category === category);
      return acc;
    },
    {} as Record<GlossaryItem['category'], GlossaryItem[]>
  );

  return (
    <>
      <header className="page-header">
        <Link href="/">dead-drop.xyz</Link>
      </header>
      <main className="main-container" style={{ paddingTop: '2rem' }}>
        <div className="animate-fade-in-up glossary-container">
          <div className="glossary-header">
            <h1 className="glossary-title">Glossary</h1>
            <p className="glossary-subtitle">Terms and definitions</p>
          </div>

          <div className="glossary-content">
            {categoryOrder.map((category) => (
              <section key={category} className="glossary-section">
                <h2 className="glossary-section-title">{categoryLabels[category]}</h2>
                <dl className="glossary-list">
                  {groupedItems[category].map((item, index) => (
                    <div key={index} className="glossary-item">
                      <dt className="glossary-term">{item.term}</dt>
                      <dd className="glossary-definition">{item.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      </main>
      <footer className="footer">
        <nav className="footer-nav">
          <Link href="/">Home</Link>
          <Link href="/how-it-works">How It Works</Link>
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
