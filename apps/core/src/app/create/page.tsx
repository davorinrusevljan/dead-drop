'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
import { decodePublicDrop, decodePrivateDrop } from '../../lib/drop-client';
import { API_URL } from '../../lib/config';
import { PasswordInput } from '@dead-drop/ui';

type CreateState = 'form' | 'success' | 'error';

export default function CreatePage() {
  const [mounted, setMounted] = useState(false);
  const [dropName, setDropName] = useState('');
  const [state, setState] = useState<CreateState>('form');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const formDisabled = isAvailable === false;

  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [content, setContent] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const normalized = normalizeDropName(hash);
      setDropName(normalized);
      window.history.replaceState(null, '', `#${normalized}`);
    }
    setMounted(true);
  }, []);

  // Check availability when drop name changes
  useEffect(() => {
    if (!dropName || !validateDropName(dropName, 12).valid) {
      setIsAvailable(null);
      return;
    }

    const checkAvailability = async () => {
      setIsCheckingAvailability(true);
      try {
        const dropId = await computeDropId(dropName);
        const response = await fetch(`${API_URL}/api/v1/drops/check/${dropId}`);
        if (response.ok) {
          const data = (await response.json()) as { available: boolean };
          setIsAvailable(data.available);
        }
      } catch {
        // If check fails, assume available (user will get error on submit)
        setIsAvailable(true);
      } finally {
        setIsCheckingAvailability(false);
      }
    };

    checkAvailability();
  }, [dropName]);

  const normalizedName = normalizeDropName(dropName);
  const validation = validateDropName(normalizedName, 12);

  const passwordsMatch = password === confirmPassword;
  const isPasswordTooShort = password.length > 0 && password.length < 8;
  const isButtonDisabled =
    isLoading ||
    isAvailable === false ||
    !password ||
    isPasswordTooShort ||
    !confirmPassword ||
    !passwordsMatch ||
    !content ||
    !agreedToTerms;

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
      let payload: string;
      let iv: string | null = null;
      let respContentHash: string | null = null;
      let adminHash: string | null = null;

      if (visibility === 'private') {
        const key = await deriveKey(password, salt);
        iv = generateIV();
        payload = await encrypt(content, key, iv);
        respContentHash = await sha256(content);
      } else {
        // Public drops: raw content string, no encoding
        payload = content;
        const computedHash = await computePublicAdminHash(password, salt);
        if (!computedHash) {
          throw new Error('Failed to compute admin hash');
        }
        adminHash = computedHash;
      }

      // Build request body - only include fields that are needed
      const requestBody: Record<string, unknown> = {
        id: dropId,
        nameLength: normalizedName.length,
        tier: 'free',
        visibility,
        payload,
        salt,
        mimeType: 'text/plain',
        I_agree_with_terms_and_conditions: true,
      };

      // Only include fields specific to visibility type
      if (visibility === 'private') {
        requestBody.iv = iv;
        requestBody.contentHash = respContentHash;
      } else {
        // Public drops require adminHash
        requestBody.adminHash = adminHash;
      }

      const response = await fetch(`${API_URL}/api/v1/drops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setState('success');
      } else if (response.status === 409) {
        setError('Drop name already taken');
        setState('error');
      } else {
        const err = await response.json();
        // Handle both {error: {message}} and ZodError formats
        const message =
          typeof err === 'object' && err && 'error' in err
            ? (err.error as { message?: string }).message ||
              (err.error as { code?: string }).code ||
              'Failed to create drop'
            : typeof err === 'object' && err && 'success' in err && !err.success && 'error' in err
              ? ((err.error as { issues?: Array<{ message?: string }> }).issues?.[0]
                  ?.message as string) || 'Failed to create drop'
              : 'Failed to create drop';
        setError(message);
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
      <header className="page-header">
        <a href="/">dead-drop.xyz</a>
      </header>
      <main className="main-container">
        {/* FORM STATE */}
        {(state === 'form' || state === 'error') && (
          <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
            <div className="terminal-container">
              <div style={{ marginBottom: '1.5rem' }}>
                {isCheckingAvailability ? (
                  <span className="tag">CHECKING...</span>
                ) : isAvailable === false ? (
                  <span className="tag" style={{ background: 'var(--danger)', color: 'white' }}>
                    ALREADY TAKEN
                  </span>
                ) : (
                  <span className="tag">✓ AVAILABLE</span>
                )}
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
                {isAvailable === false && (
                  <p
                    style={{ color: 'var(--fg-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}
                  >
                    This drop name is already taken.{' '}
                    <button
                      onClick={goHome}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                        font: 'inherit',
                      }}
                    >
                      Choose a different name
                    </button>
                  </p>
                )}
              </div>

              <div
                style={{
                  opacity: formDisabled ? 0.5 : 1,
                  pointerEvents: formDisabled ? 'none' : 'auto',
                  transition: 'opacity 0.2s',
                }}
              >
                <div className="visibility-toggle">
                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`visibility-option ${visibility === 'private' ? 'active' : ''}`}
                    disabled={formDisabled}
                  >
                    🔒 Private
                    <br />
                    <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>encrypted</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`visibility-option ${visibility === 'public' ? 'active' : ''}`}
                    disabled={formDisabled}
                  >
                    👁 Public
                    <br />
                    <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>readable</span>
                  </button>
                </div>

                <PasswordInput
                  label="Password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="min 8 characters"
                  error={isPasswordTooShort ? 'Password must be at least 8 characters' : undefined}
                  autoFocus
                  disabled={formDisabled}
                />

                <PasswordInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="repeat password"
                  error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
                  disabled={formDisabled}
                />

                <div className="form-group">
                  <label className="form-label">your drop</label>
                  <textarea
                    value={content}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setContent(e.target.value)
                    }
                    className="form-textarea"
                    placeholder="Type your secret message here..."
                    rows={6}
                    disabled={formDisabled}
                  />
                </div>

                {error && <p className="error-message">{error}</p>}

                <div className="terms-checkbox">
                  <label
                    className="terms-checkbox-label"
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                      color: 'var(--fg)',
                      opacity: 0.85,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAgreedToTerms(e.target.checked)
                      }
                      disabled={formDisabled}
                      style={{
                        cursor: formDisabled ? 'not-allowed' : 'pointer',
                        width: '1rem',
                        height: '1rem',
                        accentColor: 'var(--accent)',
                      }}
                    />
                    <span style={{ cursor: 'pointer' }}>
                      I agree with the{' '}
                      <Link
                        href="/terms"
                        style={{
                          color: 'var(--accent)',
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                        }}
                        tabIndex={-1}
                      >
                        Terms of Service
                      </Link>
                    </span>
                  </label>
                </div>

                <div className="btn-group" style={{ marginTop: '1.5rem' }}>
                  <button onClick={handleCreate} disabled={isButtonDisabled} className="action-btn">
                    {isLoading ? 'CREATING...' : 'CREATE DROP'}
                  </button>
                </div>
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
          <nav className="footer-nav">
            <a href="/">Home</a>
            <a href="/how-it-works">How It Works</a>
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
      </main>
    </>
  );
}
