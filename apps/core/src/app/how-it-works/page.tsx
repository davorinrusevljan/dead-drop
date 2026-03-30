import Link from 'next/link';
import './how-it-works.css';

interface Step {
  number: string;
  title: string;
  description: string;
  details?: string[];
}

const creationSteps: Step[] = [
  {
    number: '01',
    title: 'Choose a Name',
    description:
      'Enter a unique drop name (12+ characters for free drops). Spaces auto-convert to hyphens.',
    details: [
      'Input is normalized: lowercase, spaces → hyphens, invalid chars removed',
      'Name is validated against reserved words (api, admin, etc.)',
      'Minimum length ensures security against brute-force enumeration',
    ],
  },
  {
    number: '02',
    title: 'Set Visibility',
    description: 'Choose Private (encrypted) or Public (plaintext readable by anyone).',
    details: [
      'Private: Password encrypts content client-side, zero-knowledge',
      'Public: Content visible to all, password only for edit/delete',
    ],
  },
  {
    number: '03',
    title: 'Enter Password',
    description:
      'Your password secures the drop. For private drops, it derives the encryption key.',
    details: [
      'Password never leaves your browser',
      'Combined with random salt for key derivation',
      'Choose a strong, memorable password',
    ],
  },
  {
    number: '04',
    title: 'Add Content',
    description: 'Enter your text content (up to 10KB for free drops).',
    details: [
      'Content is wrapped in a typed payload structure',
      'Supports text/plain MIME type',
      'Future: file uploads for Deep Drops',
    ],
  },
  {
    number: '05',
    title: 'Encrypt & Upload',
    description: 'For private drops: content encrypted locally. Then uploaded to edge storage.',
    details: [
      'AES-256-GCM encryption with PBKDF2-derived key',
      'Drop ID = SHA-256(normalized_name)',
      'Stored on Cloudflare D1 with 7-day expiration',
    ],
  },
];

const accessSteps: Step[] = [
  {
    number: '01',
    title: 'Navigate to Drop',
    description: 'Visit dead-drop.xyz/#your-drop-name or enter the name in the View panel.',
    details: [
      'Fragment (#) ensures name never hits server logs',
      'Client normalizes name and computes ID locally',
    ],
  },
  {
    number: '02',
    title: 'Fetch Metadata',
    description: 'Client requests drop metadata by ID (SHA-256 hash, not name).',
    details: [
      'Server returns: visibility, salt, IV, encryption algorithm, expiry',
      'No content returned until authenticated/decrypted',
    ],
  },
  {
    number: '03',
    title: 'Unlock',
    description:
      'For private drops, enter password to decrypt. Public drops show content immediately.',
    details: [
      'Password derives same encryption key locally',
      'Key decrypts ciphertext in your browser',
      'Server never sees password or plaintext',
    ],
  },
  {
    number: '04',
    title: 'View & Manage',
    description: 'Read, edit, or delete the drop. All operations require password verification.',
    details: [
      'Edit: re-encrypts with same key, new IV',
      'Delete: permanent removal, no recovery',
      'Content hash used for optimistic concurrency',
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <header className="page-header">
        <Link href="/">dead-drop.xyz</Link>
      </header>
      <main className="main-container" style={{ paddingTop: '2rem' }}>
        <div className="animate-fade-in-up hiw-container">
          <div className="hiw-header">
            <h1 className="hiw-title">How It Works</h1>
            <p className="hiw-subtitle">The technical details behind dead-drop.xyz</p>
          </div>

          {/* Cryptographic Overview */}
          <section className="hiw-section">
            <h2 className="hiw-section-title">
              <span className="hiw-section-icon">🔐</span>
              Cryptographic Architecture
            </h2>
            <div className="crypto-overview">
              <div className="crypto-card">
                <div className="crypto-card-header">
                  <span className="crypto-algo">PBKDF2</span>
                  <span className="crypto-label">Key Derivation</span>
                </div>
                <div className="crypto-card-body">
                  <p>
                    Your password is converted into a 256-bit encryption key using PBKDF2 with
                    100,000 iterations and SHA-256. A random 16-byte salt ensures unique keys even
                    for identical passwords.
                  </p>
                  <div className="crypto-specs">
                    <span>Iterations: 100,000</span>
                    <span>Hash: SHA-256</span>
                    <span>Salt: 16 bytes</span>
                  </div>
                </div>
              </div>

              <div className="crypto-card">
                <div className="crypto-card-header">
                  <span className="crypto-algo">AES-256-GCM</span>
                  <span className="crypto-label">Encryption</span>
                </div>
                <div className="crypto-card-body">
                  <p>
                    Content is encrypted using AES in Galois/Counter Mode with a 256-bit key. GCM
                    provides both confidentiality and integrity—any tampering is detected.
                  </p>
                  <div className="crypto-specs">
                    <span>Key: 256 bits</span>
                    <span>IV: 12 bytes</span>
                    <span>Tag: 128 bits</span>
                  </div>
                </div>
              </div>

              <div className="crypto-card">
                <div className="crypto-card-header">
                  <span className="crypto-algo">SHA-256</span>
                  <span className="crypto-label">Hashing</span>
                </div>
                <div className="crypto-card-body">
                  <p>
                    Drop IDs are derived from names via SHA-256. Admin passwords for public drops
                    are hashed with salt. This one-way function ensures identifiers cannot be
                    reversed.
                  </p>
                  <div className="crypto-specs">
                    <span>Output: 256 bits</span>
                    <span>Encoding: Hex</span>
                    <span>Use: IDs, Auth</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Creation Flow */}
          <section className="hiw-section">
            <h2 className="hiw-section-title">
              <span className="hiw-section-icon">✨</span>
              Creating a Drop
            </h2>
            <div className="steps-list">
              {creationSteps.map((step) => (
                <div key={step.number} className="step-item">
                  <div className="step-number">{step.number}</div>
                  <div className="step-content">
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-description">{step.description}</p>
                    {step.details && (
                      <ul className="step-details">
                        {step.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Access Flow */}
          <section className="hiw-section">
            <h2 className="hiw-section-title">
              <span className="hiw-section-icon">🔓</span>
              Accessing a Drop
            </h2>
            <div className="steps-list">
              {accessSteps.map((step) => (
                <div key={step.number} className="step-item">
                  <div className="step-number">{step.number}</div>
                  <div className="step-content">
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-description">{step.description}</p>
                    {step.details && (
                      <ul className="step-details">
                        {step.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Privacy Design */}
          <section className="hiw-section">
            <h2 className="hiw-section-title">
              <span className="hiw-section-icon">🛡️</span>
              Privacy by Design
            </h2>
            <div className="privacy-features">
              <div className="privacy-feature">
                <h3>Fragment Routing</h3>
                <p>
                  URL fragments (the # part) are processed client-side only. Your drop name never
                  appears in server logs, CDN caches, or ISP records. We see requests for /, not
                  /#your-secret.
                </p>
              </div>
              <div className="privacy-feature">
                <h3>Client-Side Crypto</h3>
                <p>
                  All encryption happens in your browser using the Web Crypto API. Your password and
                  plaintext never traverse the network. We receive only encrypted bytes.
                </p>
              </div>
              <div className="privacy-feature">
                <h3>No Accounts</h3>
                <p>
                  No registration means no email addresses, no passwords to leak, no user profiles.
                  Drops exist independently of any identity system.
                </p>
              </div>
              <div className="privacy-feature">
                <h3>Auto-Expiring Drops</h3>
                <p>
                  Standard drops automatically expire after 7 days. Deletion is not necessarily
                  immediate and may occur later. Deletion is final and cannot be undone.
                </p>
              </div>
            </div>
          </section>

          {/* Open Source */}
          <section className="hiw-section hiw-section-cta">
            <h2 className="hiw-section-title">
              <span className="hiw-section-icon">📖</span>
              Open Source
            </h2>
            <p className="hiw-cta-text">
              Don&apos;t trust—verify. The entire codebase is available on GitHub. Audit the
              cryptography, review the API implementation, or self-host your own instance. If you
              like what you see, we&apos;d appreciate a star!
            </p>
            <a
              href="https://github.com/davorinrusevljan/dead-drop"
              target="_blank"
              rel="noopener noreferrer"
              className="hiw-cta-button"
            >
              ⭐ Star on GitHub
            </a>
          </section>
        </div>
      </main>
      <footer className="footer">
        <nav className="footer-nav">
          <Link href="/">Home</Link>
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/glossary">Glossary</Link>
          <Link href="/faq">F.A.Q.</Link>
          <Link href="/terms">Terms of Service</Link>
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
