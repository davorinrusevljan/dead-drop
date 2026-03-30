import Link from 'next/link';
import './faq.css';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const faqItems: FAQItem[] = [
  {
    question: 'What is a drop?',
    answer:
      'A drop is an ephemeral container for text content. You create it with a unique name (like "my-secret-project"), optionally protect it with a password, and share the URL. Drops automatically expire and are permanently deleted after 7 days.',
  },
  {
    question: 'What is the difference between Private and Public drops?',
    answer:
      'Private drops use zero-knowledge encryption: your content is encrypted client-side with your password, and we never see the plaintext. A password is required to both read and edit. Public drops store content as plaintext—anyone with the URL can read it, but a password is still required to edit or delete.',
  },
  {
    question: 'Do I need an account?',
    answer:
      'No. dead-drop.xyz requires no registration, no email, no personal information. Just pick a name, optionally set a password, and create your drop. This is by design—no accounts means no data to leak or compromise.',
  },
  {
    question: 'What does "zero-knowledge" mean?',
    answer:
      'Zero-knowledge means the server never has access to your unencrypted content. When you create a private drop, your password never leaves your browser. The encryption happens entirely client-side using the Web Crypto API. We literally cannot read your data, even if compelled to.',
  },
  {
    question: 'How long do drops last?',
    answer:
      'Standard drops automatically expire after 7 days. Deletion is not necessarily immediate and may occur later. Once deleted, data cannot be recovered.',
  },
  {
    question: 'How secure is the encryption?',
    answer:
      'Private drops use AES-256-GCM encryption with keys derived via PBKDF2 (100,000 iterations). This is the same class of encryption used by governments and financial institutions. However, security also depends on your password strength—use a strong, unique password.',
  },
  {
    question: 'Can I delete a drop before it expires?',
    answer:
      'Yes. For private drops, you need the content password to delete. For public drops, you need the admin password you set during creation. Once deleted, the drop is gone permanently.',
  },
  {
    question: 'What happens if I forget my password?',
    answer:
      'For private drops: the content is irrecoverable. We genuinely cannot help you—this is the trade-off of zero-knowledge encryption. For public drops: you can still read the content, but you will need the admin password to edit or delete.',
  },
  {
    question: 'Is the code open source?',
    answer: (
      <>
        Yes. The entire codebase is available on{' '}
        <a
          href="https://github.com/davorinrusevljan/dead-drop"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        . You can audit the cryptography or contribute improvements. You are welcome to self-host,
        though we have not yet optimized the setup process for seamless deployment.
      </>
    ),
  },
  {
    question: 'What is the size limit?',
    answer:
      'Standard drops are limited to 10KB of text content. This is sufficient for code snippets, configuration files, credentials, and short messages.',
  },
  {
    question: 'Why use URL fragments (#) instead of regular paths?',
    answer:
      'URL fragments (the part after #) are never sent to the server. This means your drop name never appears in server logs or ISP records. When you share dead-drop.xyz/#my-secret, our servers only see a request for "/" — complete privacy.',
  },
  {
    question: 'Is there an API for programmatic access?',
    answer:
      'A REST API for machine access is coming soon. It will allow you to create, read, and manage drops from scripts, CI/CD pipelines, and other automation tools.',
  },
  {
    question: 'Where is dead-drop hosted?',
    answer:
      'dead-drop.xyz is hosted entirely on Cloudflare infrastructure—Pages for the frontend, Workers for the API, and D1 (SQLite) for storage. This provides global edge performance and enterprise-grade reliability.',
  },
  {
    question: 'What data do you collect?',
    answer:
      'We store only what is necessary: the drop ID (a SHA-256 hash of your drop name, not the name itself), encrypted content or plaintext (depending on visibility), cryptographic parameters (salt, IV), expiration date, and metadata like creation time and version. We do not collect personal information, emails, or account data. Note that third parties—your ISP, Cloudflare—may independently collect data like your IP address. We have designed dead-drop to minimize the data intermediaries could potentially access.',
  },
  {
    question: 'Can I use dead-drop for illegal activities?',
    answer:
      'No. dead-drop is intended for legitimate privacy-preserving communication—sharing credentials, code snippets, configuration files, and similar content. If presented with valid legal orders (such as a court order or law enforcement request), we will comply to the extent required by law.',
  },
];

export default function FAQPage() {
  return (
    <>
      <header className="page-header">
        <Link href="/">dead-drop.xyz</Link>
      </header>
      <main className="main-container" style={{ paddingTop: '2rem' }}>
        <div className="animate-fade-in-up faq-container">
          <div className="faq-header">
            <h1 className="faq-title">F.A.Q.</h1>
            <p className="faq-subtitle">Frequently Asked Questions</p>
          </div>

          <div className="faq-list">
            {faqItems.map((item, index) => (
              <details key={index} className="faq-item">
                <summary className="faq-question">
                  <span className="faq-number">{String(index + 1).padStart(2, '0')}</span>
                  {item.question}
                </summary>
                <div className="faq-answer">
                  <p>{item.answer}</p>
                </div>
              </details>
            ))}
          </div>

          <div className="faq-footer">
            <p>
              Still have questions?{' '}
              <a
                href="https://github.com/davorinrusevljan/dead-drop/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open an issue on GitHub
              </a>
            </p>
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
