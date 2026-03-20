export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        fontFamily: 'JetBrains Mono, monospace',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem', color: 'var(--accent)' }}>404</h1>
      <p style={{ color: 'var(--fg-muted)', marginBottom: '2rem' }}>Page not found</p>
      <a href="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
        ← Go home
      </a>
      <p style={{ position: 'fixed', bottom: '1.5rem', fontSize: '0.75rem', opacity: 0.3 }}>
        © Ghostgrammer.xyz
      </p>
    </div>
  );
}
