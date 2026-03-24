'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  normalizeDropName,
  validateDropName,
  computeDropId,
  generateSalt,
  generateIV,
  sha256,
  deriveKey,
  encrypt,
  computePublicAdminHash,
} from '@dead-drop/engine';
import { API_URL } from '../../lib/config';

interface DropContent {
  type: 'text';
  content: string;
}

type CreateState = 'form' | 'success' | 'error';

export default function CreatePage() {
  const [mounted, setMounted] = useState(false);
  const [dropName, setDropName] = useState('');
  const [state, setState] = useState<CreateState>('form');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const normalized = normalizeDropName(hash);
      setDropName(normalized);
      window.history.replaceState(null, '', `#${normalized}`);
    }
    setMounted(true);
  }, []);

  const normalizedName = normalizeDropName(dropName);
  const validation = validateDropName(normalizedName, 12);

  const handleCreate = useCallback(async () => {
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid drop name');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!content.trim()) {
      setError('Content cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const dropId = await computeDropId(normalizedName);
      const salt = generateSalt();
      const contentPayload: DropContent = { type: 'text', content };
      const contentJson = JSON.stringify(contentPayload);
      let payload: string;
      let iv: string | null = null;
      let respContentHash: string | null = null;
      let adminHash: string | null = null;

      if (visibility === 'private') {
        const key = await deriveKey(password, salt);
        iv = generateIV();
        payload = await encrypt(contentJson, key, iv);
        respContentHash = await sha256(contentJson);
      } else {
        payload = btoa(contentJson);
        adminHash = await computePublicAdminHash(password, salt);
      }

      const response = await fetch(`${API_URL}/api/drops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dropId,
          nameLength: normalizedName.length,
          tier: 'free',
          visibility,
          payload,
          salt,
          iv,
          contentHash: respContentHash,
          adminHash,
        }),
      });

      if (response.ok) {
        setState('success');
      } else if (response.status === 409) {
        setError('Drop name already taken');
        setState('error');
      } else {
        const err = (await response.json()) as { error?: { message?: string } };
        setError(err.error?.message || 'Failed to create drop');
        setState('error');
      }
    } catch {
      setError('Network error');
      setState('error');
    } finally {
      setIsLoading(false);
    }
  }, [validation, normalizedName, password, confirmPassword, content, visibility]);

  const copyUrl = useCallback(() => {
    const url = `${window.location.origin}/#${normalizedName}`;
    navigator.clipboard.writeText(url);
  }, [normalizedName]);

  const goHome = useCallback(() => {
    window.location.href = '/';
  }, []);

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
        <header className="page-header">
          <a href="/">dead-drop.xyz</a>
        </header>
        <main className="main-container">
          <div className="loader animate-fade-in">
            <div className="loader-spinner" />
            <span>Loading...</span>
          </div>
        </main>
      </>
    );
  }

  if (!dropName || !validation.valid) {
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
        <header className="page-header">
          <a href="/">dead-drop.xyz</a>
        </header>
        <main className="main-container">
          <div className="terminal-container animate-fade-in-up" style={{ maxWidth: '32rem' }}>
            <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Invalid drop name</p>
            <p style={{ color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>
              The drop name in the URL is invalid or missing.
            </p>
            <button onClick={goHome} className="action-btn">
              Go to Home
            </button>
          </div>
        </main>
      </>
    );
  }

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
      <header className="page-header">
        <a href="/">dead-drop.xyz</a>
      </header>
      <main className="main-container">
        {/* FORM STATE */}
        {(state === 'form' || state === 'error') && (
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
                <div>
                  <span className="tag">✓ AVAILABLE</span>
                  <p
                    style={{
                      color: 'var(--accent)',
                      fontSize: '1.125rem',
                      marginTop: '0.75rem',
                      fontFamily: 'JetBrains Mono',
                    }}
                  >
                    {normalizedName}
                  </p>
                </div>
                <button
                  onClick={goHome}
                  className="secondary-btn"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                >
                  ← Home
                </button>
              </div>

              <div className="visibility-toggle">
                <button
                  onClick={() => setVisibility('private')}
                  className={`visibility-option ${visibility === 'private' ? 'active' : ''}`}
                >
                  🔒 Private
                  <br />
                  <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>encrypted</span>
                </button>
                <button
                  onClick={() => setVisibility('public')}
                  className={`visibility-option ${visibility === 'public' ? 'active' : ''}`}
                >
                  👁 Public
                  <br />
                  <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>readable</span>
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="min 8 characters"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  placeholder="repeat password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Your Secret</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="form-textarea"
                  placeholder="Type your secret message here..."
                  rows={6}
                />
              </div>

              {error && <p className="error-message">{error}</p>}

              <div className="btn-group" style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={handleCreate}
                  disabled={isLoading || !password || !confirmPassword || !content}
                  className="action-btn"
                >
                  {isLoading ? 'CREATING...' : 'CREATE DROP'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUCCESS STATE */}
        {state === 'success' && (
          <div
            className="animate-fade-in-up"
            style={{ width: '100%', maxWidth: '32rem', textAlign: 'center' }}
          >
            <svg className="checkmark" viewBox="0 0 52 52">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" />
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>

            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>DROP CREATED</h2>
            <p style={{ color: 'var(--fg-muted)', marginBottom: '2rem' }}>Share this link:</p>

            <div className="success-url">
              {typeof window !== 'undefined' && `${window.location.origin}/#${normalizedName}`}
            </div>

            <div className="btn-group" style={{ marginTop: '2rem' }}>
              <button onClick={copyUrl} className="action-btn">
                COPY LINK
              </button>
              <button onClick={goHome} className="secondary-btn">
                Go to Home
              </button>
            </div>

            <p
              style={{
                fontSize: '0.9375rem',
                color: 'var(--fg-muted)',
                marginTop: '2rem',
                opacity: 0.8,
              }}
            >
              ⚠ Save your password. It cannot be recovered.
            </p>
          </div>
        )}

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
