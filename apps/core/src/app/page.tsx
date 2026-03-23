'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  normalizeDropName,
  validateDropName,
  computeDropId,
  deriveKey,
  decrypt,
  sha256,
  generateDropNameSuggestions,
} from '@dead-drop/engine';
import { API_URL } from '../lib/config';

type AppState = 'landing' | 'checking' | 'notfound' | 'unlock' | 'view' | 'edit' | 'delete';

interface DropData {
  id: string;
  tier: 'free' | 'deep';
  visibility: 'private' | 'public';
  payload: string;
  salt: string;
  iv: string | null;
  expiresAt: string;
}

interface DropContent {
  type: 'text';
  content: string;
}

// Filter invalid characters as user types
function filterDropNameInput(value: string): string {
  // Convert spaces to hyphens, lowercase, remove invalid chars
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '');
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [hasFragment, setHasFragment] = useState(false);

  // Landing state
  const [dropName, setDropName] = useState('');
  const [dropExists, setDropExists] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);

  // View/unlock state
  const [state, setState] = useState<AppState>('landing');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropData, setDropData] = useState<DropData | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');

  // Initialize
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setHasFragment(true);
      const normalized = normalizeDropName(hash);
      checkDrop(normalized);
    } else {
      // Pre-populate with a random name
      const suggestions = generateDropNameSuggestions(1, 4);
      setDropName(suggestions[0]!);
    }
    setMounted(true);
  }, []);

  // Check if drop exists when name changes (debounced) - only on landing
  useEffect(() => {
    // Don't check if we have a fragment (view mode) or not on landing
    if (hasFragment || state !== 'landing') return;

    // Don't re-check if we just came back from a "not found" error
    if (error === 'Drop not found') return;

    const normalizedName = normalizeDropName(dropName);
    const v = validateDropName(normalizedName, 3);
    if (!v.valid) {
      setDropExists(null);
      return;
    }

    setCheckingName(true);
    const timeoutId = setTimeout(async () => {
      try {
        const dropId = await computeDropId(normalizedName);
        const response = await fetch(`${API_URL}/api/drops/${dropId}`);
        setDropExists(response.ok);
      } catch {
        setDropExists(null);
      } finally {
        setCheckingName(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [dropName, hasFragment, state, error]);

  const normalizedName = normalizeDropName(dropName);
  const validation = validateDropName(normalizedName, 12);

  // API calls
  const checkDrop = useCallback(async (name: string) => {
    const v = validateDropName(name, 3);
    if (!v.valid) {
      setError(v.error ?? 'Invalid drop name');
      setState('landing');
      setHasFragment(false);
      return;
    }
    setError(null);
    setState('checking');
    setIsLoading(true);
    try {
      const dropId = await computeDropId(name);
      const response = await fetch(`${API_URL}/api/drops/${dropId}`);
      if (response.status === 404) {
        // Drop doesn't exist, show not found state
        setError('Drop not found');
        setState('notfound');
        setHasFragment(false);
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }
      if (response.ok) {
        const data = (await response.json()) as DropData;
        setDropData(data);
        setDropName(name);
        if (data.visibility === 'public') {
          try {
            const contentJson = atob(data.payload);
            const parsed = JSON.parse(contentJson) as DropContent;
            setDecryptedContent(parsed.content);
          } catch {
            setError('Failed to decode content');
            setState('landing');
            setHasFragment(false);
            return;
          }
          setState('view');
        } else {
          setState('unlock');
        }
      } else {
        setError('Failed to check drop');
        setState('landing');
        setHasFragment(false);
      }
    } catch {
      setError('Network error');
      setState('landing');
      setHasFragment(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUnlock = useCallback(
    async (pwd: string) => {
      if (!dropData || !pwd) return;
      setIsLoading(true);
      setError(null);
      setUnlockPassword(pwd);
      try {
        const key = await deriveKey(pwd, dropData.salt);
        const contentJson = await decrypt(dropData.payload, key, dropData.iv!);
        const parsed = JSON.parse(contentJson) as DropContent;
        const hash = await sha256(contentJson);
        setContentHash(hash);
        setDecryptedContent(parsed.content);
        setState('view');
      } catch {
        setError('Invalid password');
      } finally {
        setIsLoading(false);
      }
    },
    [dropData]
  );

  const handleSaveEdit = useCallback(
    async (newContent: string, editPwd?: string) => {
      if (!dropData || !decryptedContent) return;

      // For private drops, ensure we have the unlock password and content hash
      if (dropData.visibility === 'private' && (!unlockPassword || !contentHash)) {
        setError('Session expired. Please unlock the drop again.');
        setState('unlock');
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const { generateIV, encrypt } = await import('@dead-drop/engine');
        const contentPayload: DropContent = { type: 'text', content: newContent };
        const contentJson = JSON.stringify(contentPayload);
        let payload: string;
        let iv: string | null = null;
        let reqContentHash: string | null = null;
        let newReqContentHash: string | null = null;

        if (dropData.visibility === 'private') {
          const key = await deriveKey(unlockPassword, dropData.salt);
          iv = generateIV();
          payload = await encrypt(contentJson, key, iv);
          reqContentHash = contentHash;
          // Compute the NEW content hash for the server to store
          newReqContentHash = await sha256(contentJson);
        } else {
          payload = btoa(contentJson);
        }

        const response = await fetch(`${API_URL}/api/drops/${dropData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload,
            iv,
            contentHash: reqContentHash,
            newContentHash: newReqContentHash,
            adminPassword: dropData.visibility === 'public' ? editPwd : undefined,
          }),
        });

        if (response.ok) {
          setDecryptedContent(newContent);
          // Update contentHash to the NEW hash for the next edit
          if (dropData.visibility === 'private' && newReqContentHash) {
            setContentHash(newReqContentHash);
          }
          setState('view');
        } else if (response.status === 401) {
          setError('Invalid password');
        } else {
          const err = (await response.json()) as { error?: { message?: string } };
          setError(err.error?.message || 'Failed to save');
        }
      } catch {
        setError('Network error');
      } finally {
        setIsLoading(false);
      }
    },
    [dropData, decryptedContent, unlockPassword, contentHash]
  );

  const handleDelete = useCallback(
    async (deletePwd?: string) => {
      if (!dropData) return;
      if (dropData.visibility === 'public' && !deletePwd) {
        setError('Password required');
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const body: { contentHash?: string; adminPassword?: string } = {};
        if (dropData.visibility === 'private') {
          body.contentHash = contentHash ?? '';
        } else {
          body.adminPassword = deletePwd;
        }
        const response = await fetch(`${API_URL}/api/drops/${dropData.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (response.ok) {
          window.location.href = '/';
        } else if (response.status === 401) {
          setError('Invalid password');
        } else {
          const err = (await response.json()) as { error?: { message?: string } };
          setError(err.error?.message || 'Failed to delete');
        }
      } catch {
        setError('Network error');
      } finally {
        setIsLoading(false);
      }
    },
    [dropData, contentHash]
  );

  const goHome = useCallback(() => {
    window.location.href = '/';
  }, []);

  const handleInputChange = useCallback((value: string) => {
    const filtered = filterDropNameInput(value);
    setDropName(filtered);
    setDropExists(null);
    setError(null); // Clear error when user starts typing
  }, []);

  const handleProceed = useCallback(() => {
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid drop name');
      return;
    }

    if (dropExists) {
      // Navigate to view
      checkDrop(normalizedName);
    } else {
      // Navigate to create page
      window.location.href = `/create/#${normalizedName}`;
    }
  }, [validation, dropExists, normalizedName, checkDrop]);

  // Render loading state
  if (!mounted) {
    return (
      <>
        <div className="construction-banner">
          ⚠️ Under Construction — Features may change, drops may be lost.{' '}
          <a
            href="https://github.com/davorinrusevljan/dead-drop"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
        <main className="main-container" style={{ paddingTop: '4rem' }}>
          <div className="loader animate-fade-in">
            <div className="loader-spinner" />
            <span>Initializing...</span>
          </div>
        </main>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // LANDING PAGE (no fragment)
  // ═══════════════════════════════════════════════════════════
  if (!hasFragment && state === 'landing') {
    return (
      <>
        <div className="construction-banner">
          ⚠️ Under Construction — Features may change, drops may be lost.{' '}
          <a
            href="https://github.com/davorinrusevljan/dead-drop"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
        <main className="main-container" style={{ paddingTop: '4rem' }}>
          <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
            <div className="hero">
              <h1 className="hero-title">dead-drop.xyz</h1>
              <p className="hero-subtitle">
                Share encrypted secrets that self-destruct after 7 days. Enter a drop name below to{' '}
                <strong>view an existing drop</strong> or <strong>create a new one</strong>.
              </p>
            </div>

            <div className="drop-name-section">
              <label className="drop-name-label">Enter drop name</label>
              <p className="drop-name-hint">
                Letters, numbers, hyphens, and underscores only. Minimum 12 characters to create.
              </p>

              <div className="drop-name-input-wrapper">
                <input
                  type="text"
                  value={dropName}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && validation.valid && handleProceed()}
                  onFocus={(e) => e.target.select()}
                  className="drop-name-input"
                  placeholder="e.g., project-alpha-review"
                  autoFocus
                  spellCheck={false}
                />

                {dropName && (
                  <button
                    onClick={() => handleInputChange('')}
                    className="generate-btn"
                    title="Clear"
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}

                <button
                  onClick={() => {
                    handleInputChange(generateDropNameSuggestions(1, 4)[0]!);
                  }}
                  className="generate-btn"
                  title="Generate random name"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 11-9-9" />
                    <path d="M21 3v6h-6" />
                  </svg>
                </button>
              </div>

              <div className="drop-name-footer">
                <span
                  className={`char-count ${validation.valid ? 'valid' : validation.error ? 'invalid' : ''}`}
                >
                  {normalizedName.length}/12 min chars
                </span>
              </div>

              {/* Status message */}
              {validation.valid && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: dropExists ? 'var(--accent-dim)' : 'rgba(100, 100, 255, 0.1)',
                    border: `1px solid ${dropExists ? 'var(--accent)' : 'rgba(100, 100, 255, 0.3)'}`,
                    color: dropExists ? 'var(--accent)' : '#a0a0ff',
                    fontSize: '0.875rem',
                  }}
                >
                  {checkingName ? (
                    'Checking availability...'
                  ) : dropExists ? (
                    <>🔒 Drop found — click to view and enter password</>
                  ) : dropExists === false ? (
                    <>✓ Name available — create a new encrypted drop</>
                  ) : (
                    'Enter a name to check availability'
                  )}
                </div>
              )}

              {error && <p className="error-message">{error}</p>}

              <button
                onClick={handleProceed}
                disabled={!validation.valid || checkingName}
                className="action-btn"
              >
                {checkingName
                  ? 'Checking...'
                  : dropExists === true
                    ? 'VIEW DROP'
                    : dropExists === false
                      ? 'CREATE DROP'
                      : 'Continue'}
              </button>
            </div>

            <p className="info-text">10KB · 7 days · End-to-end encrypted</p>
          </div>
          <footer className="footer">
            ©{' '}
            <a
              href="https://ghostgrammer.xyz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              Ghostgrammer.xyz
            </a>
          </footer>
        </main>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // CHECKING STATE
  // ═══════════════════════════════════════════════════════════
  if (state === 'checking') {
    return (
      <>
        <div className="construction-banner">
          ⚠️ Under Construction — Features may change, drops may be lost.{' '}
          <a
            href="https://github.com/davorinrusevljan/dead-drop"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
        <main className="main-container" style={{ paddingTop: '4rem' }}>
          <div className="loader animate-fade-in">
            <div className="loader-spinner" />
            <span>Loading drop...</span>
          </div>
        </main>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // NOT FOUND STATE
  // ═══════════════════════════════════════════════════════════
  if (state === 'notfound') {
    return (
      <>
        <div className="construction-banner">
          ⚠️ Under Construction — Features may change, drops may be lost.{' '}
          <a
            href="https://github.com/davorinrusevljan/dead-drop"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
        <main className="main-container" style={{ paddingTop: '4rem' }}>
          <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
            <div className="terminal-container" style={{ textAlign: 'center' }}>
              <p
                style={{
                  color: 'var(--danger)',
                  fontSize: '6rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  marginBottom: '1rem',
                  fontFamily: 'Syne, sans-serif',
                  opacity: 0.9,
                }}
              >
                404
              </p>
              <p
                style={{
                  color: 'var(--fg)',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                Drop Not Found
              </p>
              <p
                style={{
                  color: 'var(--fg-muted)',
                  marginBottom: '2rem',
                  fontSize: '1.125rem',
                  lineHeight: 1.6,
                }}
              >
                The drop you&apos;re looking for doesn&apos;t exist or has expired.
              </p>
              <button onClick={goHome} className="action-btn">
                Go to Home
              </button>
            </div>
          </div>
          <footer className="footer">
            ©{' '}
            <a
              href="https://ghostgrammer.xyz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              Ghostgrammer.xyz
            </a>
          </footer>
        </main>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // UNLOCK STATE (private drop)
  // ═══════════════════════════════════════════════════════════
  if (state === 'unlock' && dropData) {
    return (
      <>
        <div className="construction-banner">
          ⚠️ Under Construction — Features may change, drops may be lost.{' '}
          <a
            href="https://github.com/davorinrusevljan/dead-drop"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
        <main className="main-container" style={{ paddingTop: '4rem' }}>
          <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
            <div className="terminal-container">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                }}
              >
                <span className="tag tag-danger">🔒 ENCRYPTED</span>
                <button
                  onClick={goHome}
                  className="secondary-btn"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
                >
                  ← Home
                </button>
              </div>
              <p
                style={{
                  color: 'var(--accent)',
                  fontSize: '1.125rem',
                  marginTop: '0.5rem',
                  fontFamily: 'JetBrains Mono',
                  marginBottom: '1.5rem',
                }}
              >
                {normalizedName}
              </p>

              <p style={{ color: 'var(--fg-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                This drop is encrypted. Enter the password to unlock and view the content.
              </p>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUnlock(unlockPassword);
                    }
                  }}
                  className="form-input"
                  placeholder="enter password"
                  autoFocus
                />
              </div>

              {error && <p className="error-message">{error}</p>}

              <div className="btn-group" style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={() => handleUnlock(unlockPassword)}
                  disabled={isLoading || !unlockPassword}
                  className="action-btn"
                >
                  {isLoading ? 'DECRYPTING...' : 'UNLOCK'}
                </button>
              </div>
            </div>
          </div>
          <footer className="footer">
            ©{' '}
            <a
              href="https://ghostgrammer.xyz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              Ghostgrammer.xyz
            </a>
          </footer>
        </main>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW STATE
  // ═══════════════════════════════════════════════════════════
  if (state === 'view' && dropData && decryptedContent) {
    return (
      <>
        <div className="construction-banner">
          ⚠️ Under Construction — Features may change, drops may be lost.{' '}
          <a
            href="https://github.com/davorinrusevljan/dead-drop"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
        <main className="main-container" style={{ paddingTop: '4rem' }}>
          <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
            <div className="terminal-container">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <span className={`tag ${dropData.visibility === 'public' ? 'tag-danger' : ''}`}>
                    {dropData.visibility === 'private' ? '🔒' : '👁'}{' '}
                    {dropData.visibility.toUpperCase()}
                  </span>
                  <p
                    style={{
                      color: 'var(--accent)',
                      fontSize: '1rem',
                      marginTop: '0.5rem',
                      fontFamily: 'JetBrains Mono',
                    }}
                  >
                    {normalizedName}
                  </p>
                </div>
                <button
                  onClick={goHome}
                  className="secondary-btn"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
                >
                  ← Home
                </button>
              </div>

              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--fg-muted)',
                  marginBottom: '1rem',
                }}
              >
                Expires {new Date(dropData.expiresAt).toLocaleDateString()}
              </p>

              <div className="content-viewer">{decryptedContent}</div>

              <div className="btn-group" style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={() => navigator.clipboard.writeText(decryptedContent)}
                  className="secondary-btn"
                >
                  Copy
                </button>
                <button onClick={() => setState('edit')} className="secondary-btn">
                  Edit
                </button>
                <button
                  onClick={() => setState('delete')}
                  className="secondary-btn"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
          <footer className="footer">
            ©{' '}
            <a
              href="https://ghostgrammer.xyz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              Ghostgrammer.xyz
            </a>
          </footer>
        </main>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // EDIT STATE
  // ═══════════════════════════════════════════════════════════
  if (state === 'edit' && dropData && decryptedContent) {
    return (
      <>
        <div className="construction-banner">
          ⚠️ Under Construction — Features may change, drops may be lost.{' '}
          <a
            href="https://github.com/davorinrusevljan/dead-drop"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
        <main className="main-container" style={{ paddingTop: '4rem' }}>
          <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
            <div className="terminal-container">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem',
                }}
              >
                <span className="tag">EDITING</span>
                <button
                  onClick={() => {
                    setError(null);
                    setState('view');
                  }}
                  className="secondary-btn"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Cancel
                </button>
              </div>
              <p
                style={{
                  color: 'var(--accent)',
                  fontSize: '1rem',
                  marginBottom: '1.5rem',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {normalizedName}
              </p>

              {dropData.visibility === 'public' && (
                <div className="form-group">
                  <label className="form-label">Admin Password</label>
                  <input
                    type="password"
                    id="edit-pwd"
                    className="form-input"
                    placeholder="required"
                  />
                </div>
              )}

              <div className="form-group">
                <textarea
                  id="edit-content"
                  defaultValue={decryptedContent}
                  className="form-textarea"
                  rows={8}
                />
              </div>

              {error && <p className="error-message">{error}</p>}

              <div className="btn-group" style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={() => {
                    const newContent =
                      (document.getElementById('edit-content') as HTMLTextAreaElement)?.value || '';
                    const pwd =
                      dropData.visibility === 'public'
                        ? (document.getElementById('edit-pwd') as HTMLInputElement)?.value
                        : undefined;
                    handleSaveEdit(newContent, pwd);
                  }}
                  disabled={isLoading}
                  className="action-btn"
                >
                  {isLoading ? 'SAVING...' : 'SAVE'}
                </button>
              </div>
            </div>
          </div>
          <footer className="footer">
            ©{' '}
            <a
              href="https://ghostgrammer.xyz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              Ghostgrammer.xyz
            </a>
          </footer>
        </main>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // DELETE STATE
  // ═══════════════════════════════════════════════════════════
  if (state === 'delete' && dropData) {
    return (
      <>
        <div className="construction-banner">
          ⚠️ Under Construction — Features may change, drops may be lost.{' '}
          <a
            href="https://github.com/davorinrusevljan/dead-drop"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
        <main className="main-container" style={{ paddingTop: '4rem' }}>
          <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
            <div className="terminal-container" style={{ textAlign: 'center' }}>
              <p
                style={{
                  color: 'var(--danger)',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                Delete this drop?
              </p>
              <p
                style={{
                  color: 'var(--accent)',
                  fontFamily: 'JetBrains Mono',
                  marginBottom: '0.5rem',
                }}
              >
                {normalizedName}
              </p>
              <p
                style={{
                  color: 'var(--fg-muted)',
                  fontSize: '0.875rem',
                  marginBottom: '1.5rem',
                }}
              >
                This cannot be undone.
              </p>

              {dropData.visibility === 'public' && (
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Admin Password</label>
                  <input
                    type="password"
                    id="delete-pwd"
                    className="form-input"
                    placeholder="required"
                  />
                </div>
              )}

              {error && <p className="error-message">{error}</p>}

              <div className="btn-group" style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={() => {
                    const pwd =
                      dropData.visibility === 'public'
                        ? (document.getElementById('delete-pwd') as HTMLInputElement)?.value
                        : undefined;
                    handleDelete(pwd);
                  }}
                  disabled={isLoading}
                  className="action-btn"
                  style={{ background: 'var(--danger)' }}
                >
                  {isLoading ? 'DELETING...' : 'DELETE'}
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    setState('view');
                  }}
                  className="secondary-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
          <footer className="footer">
            ©{' '}
            <a
              href="https://ghostgrammer.xyz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              Ghostgrammer.xyz
            </a>
          </footer>
        </main>
      </>
    );
  }

  // Fallback
  return null;
}
