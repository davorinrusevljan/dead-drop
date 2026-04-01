import Link from 'next/link';
import './terms.css';

interface Section {
  title: string;
  content: string | React.ReactNode;
}

const sections: Section[] = [
  {
    title: '1. Acceptance of Terms',
    content:
      'By accessing or using dead-drop.xyz (the "Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.',
  },
  {
    title: '2. Prohibited Uses',
    content:
      'You agree not to use the Service for any illegal activities, including but not limited to: (a) sharing illegal content, (b) facilitating illegal activities, (c) violating any applicable laws or regulations, (d) distributing malware or harmful software, (e) harassment or abuse of others. We reserve the right to terminate access to the Service for any user who violates these terms.',
  },
  {
    title: '3. Legal Compliance',
    content:
      'We comply with all applicable laws and regulations. If presented with valid legal orders, we will comply to the extent required by law.',
  },
  {
    title: '4. No Warranty',
    content:
      'The Service is provided "as is" without any warranties, express or implied. We do not warrant that the Service will be uninterrupted, secure, error-free, or that any defects will be corrected. You use the Service at your own risk.',
  },
  {
    title: '5. Limitation of Liability',
    content:
      'To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of profits, or loss of use, arising from or related to your use or inability to use the Service. This includes damages resulting from service malfunction, data loss, security breaches, or any other technical issues.',
  },
  {
    title: '6. Data Retention and Deletion',
    content:
      'Drops automatically expire after 7 days. Deletion is not necessarily immediate and may occur later. Once deleted, data cannot be recovered. We are not responsible for data loss due to expiration, deletion, or technical issues. You are responsible for backing up any important content.',
  },
  {
    title: '7. User-Generated Content',
    content:
      'You retain ownership of content you create. By using the Service, you represent and warrant that you have the right to share such content. We are not responsible for content posted by users and do not endorse any user-generated content.',
  },
  {
    title: '8. Encryption Limitations',
    content:
      'While we use strong encryption (AES-256-GCM) for private drops, no encryption is perfect. Security depends on your password strength and proper use of the Service. We are not responsible for unauthorized access resulting from weak passwords, compromised devices, or user error.',
  },
  {
    title: '9. Service Modifications',
    content:
      'We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We may also update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.',
  },
  {
    title: '10. Governing Law',
    content:
      'These terms shall be governed by and construed in accordance with applicable laws. Any disputes arising from or related to these terms shall be resolved in the appropriate courts.',
  },
  {
    title: '11. Contact',
    content: (
      <>
        For questions about these Terms of Service, please contact us via{' '}
        <a
          href="https://github.com/davorinrusevljan/dead-drop/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub issues
        </a>
        .
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <header className="page-header">
        <Link href="/">dead-drop.xyz</Link>
      </header>
      <main className="main-container" style={{ paddingTop: '2rem' }}>
        <div className="animate-fade-in-up terms-container">
          <div className="terms-header">
            <h1 className="terms-title">Terms of Service</h1>
            <p className="terms-subtitle">Last updated: March 30, 2026</p>
          </div>

          <div className="terms-intro">
            <p>
              Welcome to dead-drop.xyz, a privacy-focused, ephemeral data-sharing service. Please
              read these terms carefully before using our Service.
            </p>
          </div>

          <div className="terms-list">
            {sections.map((section, index) => (
              <div key={index} className="terms-item">
                <h2 className="terms-item-title">{section.title}</h2>
                <div className="terms-item-content">
                  {typeof section.content === 'string' ? <p>{section.content}</p> : section.content}
                </div>
              </div>
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
