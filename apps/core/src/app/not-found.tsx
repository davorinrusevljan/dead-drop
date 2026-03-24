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
      <p style={{ marginTop: 'auto', paddingTop: '2rem', fontSize: '0.875rem', opacity: 0.7 }}>
        © ghostgrammer.xyz
      </p>
    </div>
  );
}
