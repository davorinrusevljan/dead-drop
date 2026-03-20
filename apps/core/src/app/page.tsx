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
  decrypt,
  computePublicAdminHash,
  generateDropNameSuggestions,
} from '@dead-drop/engine';
import { API_URL } from '../lib/config';

type AppState =
  | 'landing'
  | 'checking'
  | 'create'
  | 'unlock'
  | 'view'
  | 'edit'
  | 'delete'
  | 'success';

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

export default function HomePage() {
  const [state, setState] = useState<AppState>('landing');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dropExists, setDropExists] = useState<boolean | null>(null); // null = checking, true = exists, false = doesn't exist
  const [checkingName, setCheckingName] = useState(false);

  const [dropName, setDropName] = useState('');
  const [dropData, setDropData] = useState<DropData | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');

  // Form state
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [content, setContent] = useState('');

  // Initialize
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const normalized = normalizeDropName(hash);
      setDropName(normalized);
      checkDrop(normalized);
    } else {
      const suggestions = generateDropNameSuggestions(1, 4);
      setDropName(suggestions[0]!);
    }
    setMounted(true);
  }, []);

  // Update URL
  useEffect(() => {
    if (dropName && state !== 'success') {
      window.history.replaceState(null, '', `#${dropName}`);
    }
  }, [dropName, state]);

  const normalizedName = normalizeDropName(dropName);
  const validation = validateDropName(normalizedName, 12);

  // Check if drop exists when name changes (debounced)
  useEffect(() => {
    if (state !== 'landing') return;

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
  }, [normalizedName, state]);

  // API calls
  const checkDrop = useCallback(async (name: string) => {
    const v = validateDropName(name, 3);
    if (!v.valid) {
      setError(v.error ?? 'Invalid drop name');
      return;
    }
    setError(null);
    setState('checking');
    setIsLoading(true);
    try {
      const dropId = await computeDropId(name);
      const response = await fetch(`${API_URL}/api/drops/${dropId}`);
      if (response.status === 404) {
        setState('create');
      } else if (response.ok) {
        const data = (await response.json()) as DropData;
        setDropData(data);
        if (data.visibility === 'public') {
          try {
            const contentJson = atob(data.payload);
            const parsed = JSON.parse(contentJson) as DropContent;
            setDecryptedContent(parsed.content);
          } catch {
            setError('Failed to decode content');
            setState('landing');
            return;
          }
          setState('view');
        } else {
          setState('unlock');
        }
      } else {
        setError('Failed to check drop');
        setState('landing');
      }
    } catch {
      setError('Network error');
      setState('landing');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleProceed = useCallback(() => {
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid drop name');
      return;
    }
    checkDrop(normalizedName);
  }, [validation, normalizedName, checkDrop]);

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
      } else {
        const err = (await response.json()) as { error?: { message?: string } };
        setError(err.error?.message || 'Failed to create drop');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [validation, normalizedName, password, confirmPassword, content, visibility]);

  const handleSaveEdit = useCallback(
    async (newContent: string, editPwd?: string) => {
      if (!dropData || !decryptedContent) return;
      setIsLoading(true);
      setError(null);
      try {
        const contentPayload: DropContent = { type: 'text', content: newContent };
        const contentJson = JSON.stringify(contentPayload);
        let payload: string;
        let iv: string | null = null;
        let reqContentHash: string | null = null;

        if (dropData.visibility === 'private') {
          const key = await deriveKey(unlockPassword, dropData.salt);
          iv = generateIV();
          payload = await encrypt(contentJson, key, iv);
          reqContentHash = contentHash;
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
            adminPassword: dropData.visibility === 'public' ? editPwd : undefined,
          }),
        });

        if (response.ok) {
          setDecryptedContent(newContent);
          if (dropData.visibility === 'private') {
            setContentHash(await sha256(contentJson));
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
          handleReset();
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

  const handleReset = useCallback(() => {
    setState('landing');
    setDropData(null);
    setError(null);
    setDecryptedContent(null);
    setContentHash(null);
    setDropExists(null);
    setUnlockPassword('');
    setPassword('');
    setConfirmPassword('');
    setContent('');
    setVisibility('private');
    const suggestions = generateDropNameSuggestions(1, 4);
    setDropName(suggestions[0]!);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const generateNew = useCallback(() => {
    const suggestions = generateDropNameSuggestions(1, 4);
    setDropName(suggestions[0]!);
  }, []);

  const copyUrl = useCallback(() => {
    const url = `${window.location.origin}/#${normalizedName}`;
    navigator.clipboard.writeText(url);
  }, [normalizedName]);

  // Render
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
        {!mounted ? (
          <div className="loader animate-fade-in">
            <div className="loader-spinner" />
            <span>Initializing...</span>
          </div>
        ) : (
          <>
            {/* LANDING STATE */}
            {state === 'landing' && (
              <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '28rem' }}>
                <div className="hero">
                  <h1 className="hero-title">dead-drop.xyz</h1>
                  <p className="hero-subtitle">
                    Create encrypted, ephemeral messages that self-destruct after 7 days.
                    Zero-knowledge encryption — even we can&apos;t read them.
                  </p>
                </div>

                <div className="drop-name-section">
                  <label className="drop-name-label">Name your drop</label>
                  <p className="drop-name-hint">
                    This becomes part of the shareable link. Use something memorable.
                  </p>

                  <div className="drop-name-input-wrapper">
                    <input
                      type="text"
                      value={dropName}
                      onChange={(e) => setDropName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleProceed()}
                      className="drop-name-input"
                      placeholder="e.g., project-alpha-review"
                      autoFocus
                      spellCheck={false}
                    />

                    <button
                      onClick={generateNew}
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

                  <button
                    onClick={handleProceed}
                    disabled={!validation.valid || checkingName}
                    className="action-btn"
                  >
                    {isLoading || checkingName
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
            )}

            {/* CHECKING STATE */}
            {state === 'checking' && (
              <div className="loader animate-fade-in">
                <div className="loader-spinner" />
                <span>Scanning...</span>
              </div>
            )}

            {/* CREATE STATE */}
            {state === 'create' && (
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
                      onClick={handleReset}
                      className="secondary-btn"
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="visibility-toggle">
                    <button
                      onClick={() => setVisibility('private')}
                      className={`visibility-option ${visibility === 'private' ? 'active' : ''}`}
                    >
                      🔒 Private
                      <br />
                      <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>encrypted</span>
                    </button>
                    <button
                      onClick={() => setVisibility('public')}
                      className={`visibility-option ${visibility === 'public' ? 'active' : ''}`}
                    >
                      👁 Public
                      <br />
                      <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>readable</span>
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
                    <button onClick={handleReset} className="secondary-btn">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* UNLOCK STATE */}
            {state === 'unlock' && dropData && (
              <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
                <div className="terminal-container">
                  <span className="tag tag-danger">🔒 ENCRYPTED</span>
                  <p
                    style={{
                      color: 'var(--accent)',
                      fontSize: '1.125rem',
                      marginTop: '0.75rem',
                      fontFamily: 'JetBrains Mono',
                      marginBottom: '2rem',
                    }}
                  >
                    {normalizedName}
                  </p>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUnlock((e.target as HTMLInputElement).value);
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
                      onClick={(e) =>
                        handleUnlock(
                          (e.currentTarget.previousElementSibling as HTMLInputElement)?.value || ''
                        )
                      }
                      disabled={isLoading}
                      className="action-btn"
                    >
                      {isLoading ? 'DECRYPTING...' : 'UNLOCK'}
                    </button>
                    <button onClick={handleReset} className="secondary-btn">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW STATE */}
            {state === 'view' && dropData && decryptedContent && (
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
                      <span
                        className={`tag ${dropData.visibility === 'public' ? 'tag-danger' : ''}`}
                      >
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                      expires {new Date(dropData.expiresAt).toLocaleDateString()}
                    </span>
                  </div>

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

                  <button
                    onClick={handleReset}
                    className="secondary-btn"
                    style={{ width: '100%', marginTop: '1rem' }}
                  >
                    View Another Drop
                  </button>
                </div>
              </div>
            )}

            {/* EDIT STATE */}
            {state === 'edit' && dropData && decryptedContent && (
              <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
                <div className="terminal-container">
                  <span className="tag">EDITING</span>
                  <p
                    style={{
                      color: 'var(--accent)',
                      fontSize: '1rem',
                      marginTop: '0.5rem',
                      fontFamily: 'JetBrains Mono',
                      marginBottom: '1.5rem',
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
                          (document.getElementById('edit-content') as HTMLTextAreaElement)?.value ||
                          '';
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
            )}

            {/* DELETE STATE */}
            {state === 'delete' && dropData && (
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
                  <button onClick={handleReset} className="secondary-btn">
                    Create Another
                  </button>
                </div>

                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--fg-muted)',
                    marginTop: '2rem',
                    opacity: 0.6,
                  }}
                >
                  ⚠ Save your password. It cannot be recovered.
                </p>
              </div>
            )}
          </>
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
