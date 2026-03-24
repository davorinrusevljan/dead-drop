'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  normalizeDropName,
  validateDropName,
  computeDropId,
  deriveKey,
  decrypt,
  sha256,
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

// Validation thresholds
const CREATE_MIN_LENGTH = 12;
const VIEW_MIN_LENGTH = 3;

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [hasFragment, setHasFragment] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'create' | 'view'>('create');

  // Refs for input focus
  const createInputRef = useRef<HTMLInputElement>(null);
  const viewInputRef = useRef<HTMLInputElement>(null);

  // Create tab state
  const [createName, setCreateName] = useState('');
  const [createChecking, setCreateChecking] = useState(false);
  const [createAvailable, setCreateAvailable] = useState<boolean | null>(null);
  const [generatingName, setGeneratingName] = useState(false);

  // View tab state
  const [viewName, setViewName] = useState('');
  const [viewChecking, setViewChecking] = useState(false);
  const [viewExists, setViewExists] = useState<boolean | null>(null);

  // View/unlock state
  const [state, setState] = useState<AppState>('landing');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropData, setDropData] = useState<DropData | null>(null);
  const [currentDropName, setCurrentDropName] = useState('');
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
      // Pre-populate create lane with a random name from API
      fetchGeneratedName();
    }
    setMounted(true);
    // Intentionally empty deps - we only want this to run once on mount
  }, []);

  // Check availability for create lane (debounced)
  useEffect(() => {
    if (hasFragment || state !== 'landing') return;

    const normalizedName = normalizeDropName(createName);
    const v = validateDropName(normalizedName, CREATE_MIN_LENGTH);
    if (!v.valid) {
      setCreateAvailable(null);
      return;
    }

    setCreateChecking(true);
    const timeoutId = setTimeout(async () => {
      try {
        const dropId = await computeDropId(normalizedName);
        const response = await fetch(`${API_URL}/api/drops/${dropId}`);
        setCreateAvailable(!response.ok); // Available if NOT found
      } catch {
        setCreateAvailable(null);
      } finally {
        setCreateChecking(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [createName, hasFragment, state]);

  // Check existence for view lane (debounced)
  useEffect(() => {
    if (hasFragment || state !== 'landing') return;

    const normalizedName = normalizeDropName(viewName);
    const v = validateDropName(normalizedName, VIEW_MIN_LENGTH);
    if (!v.valid) {
      setViewExists(null);
      return;
    }

    setViewChecking(true);
    const timeoutId = setTimeout(async () => {
      try {
        const dropId = await computeDropId(normalizedName);
        const response = await fetch(`${API_URL}/api/drops/${dropId}`);
        setViewExists(response.ok);
      } catch {
        setViewExists(null);
      } finally {
        setViewChecking(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [viewName, hasFragment, state]);

  const normalizedCreateName = normalizeDropName(createName);
  const createValidation = validateDropName(normalizedCreateName, CREATE_MIN_LENGTH);

  const normalizedViewName = normalizeDropName(viewName);
  const viewValidation = validateDropName(normalizedViewName, VIEW_MIN_LENGTH);

  // API calls
  const checkDrop = useCallback(async (name: string) => {
    const v = validateDropName(name, VIEW_MIN_LENGTH);
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
        setCurrentDropName(name);
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

  const handleCreateInputChange = useCallback((value: string) => {
    const filtered = filterDropNameInput(value);
    setCreateName(filtered);
    setCreateAvailable(null);
    setError(null);
  }, []);

  const handleViewInputChange = useCallback((value: string) => {
    const filtered = filterDropNameInput(value);
    setViewName(filtered);
    setViewExists(null);
    setError(null);
  }, []);

  // Fetch a random generated name from the API
  const fetchGeneratedName = useCallback(async () => {
    setGeneratingName(true);
    try {
      const response = await fetch(`${API_URL}/api/drops/generate-name`);
      if (response.ok) {
        const data = (await response.json()) as { name: string; id: string };
        handleCreateInputChange(data.name);
      } else {
        // Fallback: generate locally if API fails
        const { generateDropNameSuggestions } = await import('@dead-drop/engine');
        handleCreateInputChange(generateDropNameSuggestions(1, 4)[0]!);
      }
    } catch {
      // Fallback: generate locally if API fails
      const { generateDropNameSuggestions } = await import('@dead-drop/engine');
      handleCreateInputChange(generateDropNameSuggestions(1, 4)[0]!);
    } finally {
      setGeneratingName(false);
    }
  }, [handleCreateInputChange]);

  const handleCreate = useCallback(() => {
    if (!createValidation.valid) {
      setError(createValidation.error ?? 'Invalid drop name');
      return;
    }
    window.location.href = `/create/#${normalizedCreateName}`;
  }, [createValidation, normalizedCreateName]);

  const handleView = useCallback(() => {
    if (!viewValidation.valid) {
      setError(viewValidation.error ?? 'Invalid drop name');
      return;
    }
    checkDrop(normalizedViewName);
  }, [viewValidation, normalizedViewName, checkDrop]);

  const handleTabSwitch = useCallback((tab: 'create' | 'view') => {
    setActiveTab(tab);
    // Focus the input after a short delay to allow the animation to complete
    setTimeout(() => {
      if (tab === 'create' && createInputRef.current) {
        createInputRef.current.focus();
      } else if (tab === 'view' && viewInputRef.current) {
        viewInputRef.current.focus();
      }
    }, 100);
  }, []);

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
  // LANDING PAGE (no fragment) - SPLIT PANEL DESIGN
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
          <div className="animate-fade-in-up" style={{ width: '100%' }}>
            <div className="hero" style={{ marginBottom: '2rem' }}>
              <h1 className="hero-title">dead-drop.xyz</h1>
              <p className="hero-subtitle">
                Share encrypted secrets that self-destruct after 7 days.
              </p>
            </div>

            <div className="split-container">
              {/* CREATE CARD - Expanded by default */}
              <div
                className={`split-card split-card-create ${activeTab === 'create' ? 'expanded' : ''}`}
                onClick={() => activeTab !== 'create' && handleTabSwitch('create')}
              >
                <div className="split-header">
                  <div className="split-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="split-header-text">
                    <div className="split-title">Create Drop</div>
                    <div className="split-desc">
                      Generate a new encrypted drop with a unique name.
                    </div>
                  </div>
                  <div className="split-hint">min 12 chars</div>
                </div>

                <div className="split-content">
                  <div className="split-input-wrapper">
                    <input
                      ref={createInputRef}
                      type="text"
                      value={createName}
                      onChange={(e) => handleCreateInputChange(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && createValidation.valid && handleCreate()
                      }
                      className={`split-input ${(createName && !createValidation.valid) || (createValidation.valid && createAvailable === false) ? 'error' : ''}`}
                      placeholder="enter-your-drop-name"
                      spellCheck={false}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateInputChange('');
                      }}
                      className="split-btn-icon"
                      title="Clear"
                      style={{
                        opacity: createName ? 1 : 0.5,
                        pointerEvents: createName ? 'auto' : 'none',
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchGeneratedName();
                      }}
                      disabled={generatingName}
                      className="split-btn-icon"
                      title="Generate random name"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-9-9" />
                        <path d="M21 3v6h-6" />
                      </svg>
                    </button>
                  </div>

                  <div className="split-footer">
                    <span className={`split-char-count ${createValidation.valid ? 'valid' : ''}`}>
                      {normalizedCreateName.length}/{CREATE_MIN_LENGTH} min chars
                    </span>
                  </div>

                  {createValidation.valid && (
                    <div
                      className={`split-status ${createChecking ? 'checking' : createAvailable ? 'available' : 'exists'}`}
                    >
                      {createChecking ? (
                        <>
                          <span
                            className="loader-spinner"
                            style={{ width: 14, height: 14, borderWidth: 1 }}
                          />
                          Checking...
                        </>
                      ) : createAvailable ? (
                        <>✓ Name available — ready to create</>
                      ) : (
                        <>⚠ Name already taken</>
                      )}
                    </div>
                  )}

                  {error && activeTab === 'create' && <p className="error-message">{error}</p>}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreate();
                    }}
                    disabled={
                      !createValidation.valid || createChecking || createAvailable === false
                    }
                    className="split-action-btn"
                  >
                    {createChecking ? 'Checking...' : 'Create Drop'}
                  </button>

                  <div className="split-badges">
                    <span className="split-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      E2E Encrypted
                    </span>
                    <span className="split-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      7 Days
                    </span>
                    <span className="split-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6M12 18v-6M9 15h6" />
                      </svg>
                      10KB
                    </span>
                  </div>
                </div>
              </div>

              {/* VIEW CARD - Collapsed by default */}
              <div
                className={`split-card split-card-view ${activeTab === 'view' ? 'expanded' : ''}`}
                onClick={() => activeTab !== 'view' && handleTabSwitch('view')}
              >
                <div className="split-header">
                  <div className="split-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <div className="split-header-text">
                    <div className="split-title">View Drop</div>
                    <div className="split-desc">Access an existing drop by entering its name.</div>
                  </div>
                  <div className="split-hint">min 3 chars</div>
                </div>

                <div className="split-content">
                  <div className="split-input-wrapper">
                    <input
                      ref={viewInputRef}
                      type="text"
                      value={viewName}
                      onChange={(e) => handleViewInputChange(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && viewValidation.valid && handleView()}
                      className={`split-input ${viewValidation.valid && viewExists === false ? 'error' : ''}`}
                      placeholder="enter-drop-name"
                      spellCheck={false}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewInputChange('');
                      }}
                      className="split-btn-icon"
                      title="Clear"
                      style={{
                        opacity: viewName ? 1 : 0.5,
                        pointerEvents: viewName ? 'auto' : 'none',
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="split-footer">
                    <span className={`split-char-count ${viewValidation.valid ? 'valid' : ''}`}>
                      {normalizedViewName.length}/{VIEW_MIN_LENGTH} min chars
                    </span>
                  </div>

                  {viewValidation.valid && (
                    <div
                      className={`split-status ${viewChecking ? 'checking' : viewExists ? 'exists' : 'notfound'}`}
                    >
                      {viewChecking ? (
                        <>
                          <span
                            className="loader-spinner"
                            style={{ width: 14, height: 14, borderWidth: 1 }}
                          />
                          Searching...
                        </>
                      ) : viewExists ? (
                        <>🔒 Drop found — click to unlock</>
                      ) : (
                        <>✗ No drop found</>
                      )}
                    </div>
                  )}

                  {error && activeTab === 'view' && <p className="error-message">{error}</p>}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleView();
                    }}
                    disabled={!viewValidation.valid || viewChecking || viewExists === false}
                    className="split-action-btn"
                  >
                    {viewChecking ? 'Searching...' : 'View Drop'}
                  </button>

                  <div className="split-badges">
                    <span className="split-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      Password Protected
                    </span>
                    <span className="split-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Editable
                    </span>
                  </div>
                </div>
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
            <div className="loader-spinner amber" />
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
            <div className="terminal-container view-mode" style={{ textAlign: 'center' }}>
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
              <button onClick={goHome} className="action-btn amber">
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
            <div className="terminal-container view-mode">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                }}
              >
                <span className="tag tag-amber">🔒 ENCRYPTED</span>
                <button
                  onClick={goHome}
                  className="secondary-btn"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                >
                  ← Home
                </button>
              </div>
              <p
                style={{
                  color: 'var(--amber)',
                  fontSize: '1.125rem',
                  marginTop: '0.5rem',
                  fontFamily: 'JetBrains Mono',
                  marginBottom: '1.5rem',
                }}
              >
                {currentDropName}
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
                  className="action-btn amber"
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
            <div className="terminal-container view-mode">
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
                    className={`tag ${dropData.visibility === 'public' ? 'tag-danger' : 'tag-amber'}`}
                  >
                    {dropData.visibility === 'private' ? '🔒' : '👁'}{' '}
                    {dropData.visibility.toUpperCase()}
                  </span>
                  <p
                    style={{
                      color: 'var(--amber)',
                      fontSize: '1rem',
                      marginTop: '0.5rem',
                      fontFamily: 'JetBrains Mono',
                    }}
                  >
                    {currentDropName}
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
            <div className="terminal-container view-mode">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem',
                }}
              >
                <span className="tag tag-amber">EDITING</span>
                <button
                  onClick={() => {
                    setError(null);
                    setState('view');
                  }}
                  className="secondary-btn"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
              <p
                style={{
                  color: 'var(--amber)',
                  fontSize: '1rem',
                  marginBottom: '1.5rem',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {currentDropName}
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
                  className="action-btn amber"
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
            <div className="terminal-container view-mode" style={{ textAlign: 'center' }}>
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
                  color: 'var(--amber)',
                  fontFamily: 'JetBrains Mono',
                  marginBottom: '0.5rem',
                }}
              >
                {currentDropName}
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
