'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  normalizeDropName,
  validateDropName,
  computeDropId,
  cryptoRegistry,
  sha256,
  type EncryptionAlgorithm,
  type EncryptionParams,
  type MimeType,
} from '@dead-drop/engine';
import { API_URL } from '../lib/config';
import {
  fetchVersionList,
  fetchVersion,
  type VersionListResponse,
  type DropVersionInfo,
  type VersionDataResponse,
} from '../lib/drop-client';
import { PasswordInput } from '@dead-drop/ui';

type AppState = 'landing' | 'checking' | 'notfound' | 'unlock' | 'view' | 'edit' | 'delete';

interface DropData {
  id: string;
  tier: 'free' | 'deep';
  visibility: 'private' | 'public';
  payload: string;
  salt: string;
  iv: string | null;
  encryptionAlgo: EncryptionAlgorithm;
  encryptionParams: EncryptionParams | null;
  mimeType: MimeType;
  hashAlgo: string;
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
  const [agreedToViewTerms, setAgreedToViewTerms] = useState(false);

  // Version history state
  const [versionList, setVersionList] = useState<VersionListResponse | null>(null);
  const [versionsExpanded, setVersionsExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionDataResponse | null>(null);
  const [showVersionPopup, setShowVersionPopup] = useState(false);
  const [selectedVersionContent, setSelectedVersionContent] = useState<string | null>(null);
  const [isFetchingVersion, setIsFetchingVersion] = useState(false);

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
        const response = await fetch(`${API_URL}/api/v1/drops/check/${dropId}`);
        if (response.ok) {
          const data = (await response.json()) as { available: boolean };
          setCreateAvailable(data.available);
        } else {
          setCreateAvailable(null);
        }
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
        const response = await fetch(`${API_URL}/api/v1/drops/check/${dropId}`);
        if (response.ok) {
          const data = (await response.json()) as { available: boolean };
          setViewExists(!data.available); // Exists if NOT available
        } else {
          setViewExists(null);
        }
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
      const response = await fetch(
        `${API_URL}/api/v1/drops/${dropId}?I_agree_with_terms_and_conditions=true`
      );
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
          setAgreedToViewTerms(false);
          setState('unlock');
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
        // Get the crypto provider for the drop's algorithm
        const provider = cryptoRegistry.get(dropData.encryptionAlgo);
        const key = await provider.deriveKey(
          pwd,
          dropData.salt,
          dropData.encryptionParams ?? undefined
        );
        const contentJson = await provider.decrypt(dropData.payload, key, dropData.iv!);
        const parsed = JSON.parse(contentJson) as DropContent;
        const hash = await sha256(contentJson);
        setContentHash(hash);
        setDecryptedContent(parsed.content);
        setAgreedToViewTerms(false);
        setState('view');
      } catch {
        setError('Invalid password');
      } finally {
        setIsLoading(false);
      }
    },
    [dropData]
  );

  // Fetch version list after unlock
  const fetchVersions = useCallback(async (id: string) => {
    try {
      const versions = await fetchVersionList(id);
      setVersionList(versions);
    } catch {
      // Silently fail - version history is optional
      setVersionList(null);
    }
  }, []);

  // Fetch versions when drop is unlocked
  useEffect(() => {
    if (state === 'view' && dropData) {
      fetchVersions(dropData.id);
    }
  }, [state, dropData, fetchVersions]);

  // Fetch and decrypt a specific version
  const handleViewVersion = useCallback(
    async (versionInfo: DropVersionInfo) => {
      if (!dropData) return;
      setIsFetchingVersion(true);
      try {
        const versionData = await fetchVersion(dropData.id, versionInfo.version);
        setSelectedVersion(versionData);

        let content: string;
        if (dropData.visibility === 'private') {
          if (!unlockPassword) {
            setError('Password required to view versions');
            return;
          }
          const provider = cryptoRegistry.get(dropData.encryptionAlgo);
          const key = await provider.deriveKey(
            unlockPassword,
            dropData.salt,
            dropData.encryptionParams ?? undefined
          );
          const contentJson = await provider.decrypt(versionData.payload, key, versionData.iv!);
          const parsed = JSON.parse(contentJson) as DropContent;
          content = parsed.content;
        } else {
          // Public drop - just decode
          const contentJson = atob(versionData.payload);
          const parsed = JSON.parse(contentJson) as DropContent;
          content = parsed.content;
        }

        setSelectedVersionContent(content);
        setShowVersionPopup(true);
      } catch {
        setError('Failed to load version');
      } finally {
        setIsFetchingVersion(false);
      }
    },
    [dropData, unlockPassword]
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
        const contentPayload: DropContent = { type: 'text', content: newContent };
        const contentJson = JSON.stringify(contentPayload);
        let payload: string;
        let iv: string | null = null;
        let reqContentHash: string | null = null;
        let newReqContentHash: string | null = null;

        if (dropData.visibility === 'private') {
          // Get the crypto provider for the drop's algorithm
          const provider = cryptoRegistry.get(dropData.encryptionAlgo);
          const key = await provider.deriveKey(
            unlockPassword,
            dropData.salt,
            dropData.encryptionParams ?? undefined
          );
          iv = provider.generateIV();
          payload = await provider.encrypt(contentJson, key, iv);
          reqContentHash = contentHash;
          // Compute the NEW content hash for the server to store
          newReqContentHash = await sha256(contentJson);
        } else {
          // Public drops - no encryption, just base64 encode
          payload = btoa(contentJson);
        }

        // Build request body
        const requestBody: Record<string, unknown> = {
          payload,
          I_agree_with_terms_and_conditions: true,
        };

        // Only include fields specific to visibility type
        if (dropData.visibility === 'private') {
          requestBody.iv = iv;
          requestBody.contentHash = reqContentHash;
          requestBody.newContentHash = newReqContentHash;
        } else {
          requestBody.adminPassword = editPwd;
        }

        const response = await fetch(`${API_URL}/api/v1/drops/${dropData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
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
          const err = await response.json();
          // Handle both {error: {message}} and ZodError formats
          const message =
            typeof err === 'object' && err && 'error' in err
              ? (err.error as { message?: string }).message ||
                (err.error as { code?: string }).code ||
                'Failed to save'
              : typeof err === 'object' && err && 'success' in err && !err.success && 'error' in err
                ? ((err.error as { issues?: Array<{ message?: string }> }).issues?.[0]
                    ?.message as string) || 'Failed to save'
                : 'Failed to save';
          setError(message);
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
        const body: {
          contentHash?: string;
          adminPassword?: string;
          I_agree_with_terms_and_conditions: true;
        } = { I_agree_with_terms_and_conditions: true };
        if (dropData.visibility === 'private') {
          body.contentHash = contentHash ?? '';
        } else {
          body.adminPassword = deletePwd;
        }
        const response = await fetch(`${API_URL}/api/v1/drops/${dropData.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (response.ok) {
          window.location.href = '/';
        } else if (response.status === 401) {
          setError('Invalid password');
        } else {
          const err = await response.json();
          // Handle both {error: {message}} and ZodError formats
          const message =
            typeof err === 'object' && err && 'error' in err
              ? (err.error as { message?: string }).message ||
                (err.error as { code?: string }).code ||
                'Failed to delete'
              : typeof err === 'object' && err && 'success' in err && !err.success && 'error' in err
                ? ((err.error as { issues?: Array<{ message?: string }> }).issues?.[0]
                    ?.message as string) || 'Failed to delete'
                : 'Failed to delete';
          setError(message);
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
      const response = await fetch(`${API_URL}/api/v1/drops/generate-name`);
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
        <header className="page-header">
          <a href="/">dead-drop.xyz</a>
        </header>
        <main className="main-container">
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
        <main className="main-container" style={{ paddingTop: '4rem' }}>
          <div className="animate-fade-in-up" style={{ width: '100%' }}>
            <div className="hero" style={{ marginBottom: '2rem' }}>
              <h1 className="hero-title">dead-drop.xyz</h1>
              <p className="hero-subtitle">
                <strong>Dead simple. Zero knowledge.</strong>
                <br />
                <span style={{ opacity: 0.85, display: 'inline-block', marginTop: '0.5rem' }}>
                  Share snippets or encrypted secrets without an account.{' '}
                  <a
                    href="https://github.com/davorinrusevljan/dead-drop"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                  >
                    Open-source
                  </a>
                  , ephemeral, truly private. Gone in 7 days.
                </span>
                <br />
                <a
                  href="https://davorinrusevljan.github.io/dead-drop/latest/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    opacity: 0.8,
                    fontSize: '0.875rem',
                    display: 'inline-block',
                    marginTop: '0.75rem',
                    color: 'var(--accent)',
                    textDecoration: 'underline',
                  }}
                >
                  Full API available
                </a>
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
            <nav className="footer-nav">
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
            <span style={{ opacity: 0.7 }}>
              ©{' '}
              <a
                href="https://ghostgrammer.xyz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit' }}
              >
                ghostgrammer.xyz
              </a>
            </span>
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
        <header className="page-header amber">
          <a href="/">dead-drop.xyz</a>
        </header>
        <main className="main-container">
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
        <header className="page-header amber">
          <a href="/">dead-drop.xyz</a>
        </header>
        <main className="main-container">
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
            <nav className="footer-nav">
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
            <span style={{ opacity: 0.7 }}>
              ©{' '}
              <a
                href="https://ghostgrammer.xyz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit' }}
              >
                ghostgrammer.xyz
              </a>
            </span>
          </footer>
        </main>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // UNLOCK STATE
  // ═══════════════════════════════════════════════════════════
  if (state === 'unlock' && dropData) {
    const isPublic = dropData.visibility === 'public';

    return (
      <>
        <header className="page-header amber">
          <a href="/">dead-drop.xyz</a>
        </header>
        <main className="main-container">
          <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
            <div className="terminal-container view-mode">
              <div style={{ marginBottom: '1rem' }}>
                <span className={`tag ${isPublic ? 'tag-danger' : 'tag-amber'}`}>
                  {isPublic ? '👁 PUBLIC' : '🔒 ENCRYPTED'}
                </span>
                <p
                  style={{
                    color: 'var(--amber)',
                    fontSize: '1.125rem',
                    marginTop: '0.5rem',
                    fontFamily: 'JetBrains Mono',
                  }}
                >
                  {currentDropName}
                </p>
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

              {!isPublic && (
                <p
                  style={{ color: 'var(--fg-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}
                >
                  This drop is encrypted. Enter the password to unlock and view the content.
                </p>
              )}

              {!isPublic && (
                <PasswordInput
                  label="Password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && agreedToViewTerms) {
                      if (isPublic) {
                        setState('view');
                      } else {
                        handleUnlock(unlockPassword);
                      }
                    }
                  }}
                  placeholder="enter password"
                  autoFocus
                />
              )}

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
                    checked={agreedToViewTerms}
                    onChange={(e) => setAgreedToViewTerms(e.target.checked)}
                    style={{
                      cursor: 'pointer',
                      width: '1rem',
                      height: '1rem',
                      accentColor: 'var(--amber)',
                    }}
                  />
                  <span style={{ cursor: 'pointer' }}>
                    By viewing content of this drop I agree with the{' '}
                    <Link
                      href="/terms"
                      style={{
                        color: 'var(--amber)',
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
                <button
                  onClick={() => {
                    if (isPublic) {
                      setState('view');
                    } else {
                      handleUnlock(unlockPassword);
                    }
                  }}
                  disabled={isLoading || !agreedToViewTerms || (!isPublic && !unlockPassword)}
                  className="action-btn amber"
                >
                  {isLoading ? 'DECRYPTING...' : isPublic ? 'VIEW' : 'UNLOCK'}
                </button>
              </div>
            </div>
          </div>
          <footer className="footer">
            <nav className="footer-nav">
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
            <span style={{ opacity: 0.7 }}>
              ©{' '}
              <a
                href="https://ghostgrammer.xyz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit' }}
              >
                ghostgrammer.xyz
              </a>
            </span>
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
        <header className="page-header amber">
          <a href="/">dead-drop.xyz</a>
        </header>
        <main className="main-container">
          <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '32rem' }}>
            <div className="terminal-container view-mode">
              <div style={{ marginBottom: '1rem' }}>
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

              {/* Version History Section */}
              {versionList && versionList.versions.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                  <button
                    onClick={() => setVersionsExpanded(!versionsExpanded)}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                      color: 'var(--fg-muted)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{
                        width: '14px',
                        height: '14px',
                        transform: versionsExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {versionList.versions.length} version
                    {versionList.versions.length !== 1 ? 's' : ''} available
                  </button>

                  {versionsExpanded && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                      }}
                    >
                      {versionList.versions.map((v) => (
                        <button
                          key={v.version}
                          onClick={() => handleViewVersion(v)}
                          disabled={isFetchingVersion}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            padding: '0.75rem 1rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.875rem',
                            color: v.version === versionList.current ? 'var(--amber)' : 'var(--fg)',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--bg-hover)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span>
                            Version {v.version}
                            {v.version === versionList.current && ' (current)'}
                          </span>
                          <span style={{ color: 'var(--fg-muted)', fontSize: '0.75rem' }}>
                            {new Date(v.createdAt).toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
            <nav className="footer-nav">
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
            <span style={{ opacity: 0.7 }}>
              ©{' '}
              <a
                href="https://ghostgrammer.xyz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit' }}
              >
                ghostgrammer.xyz
              </a>
            </span>
          </footer>
        </main>

        {/* Version Popup */}
        {showVersionPopup && selectedVersion && selectedVersionContent && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
            }}
            onClick={() => setShowVersionPopup(false)}
          >
            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                maxWidth: '32rem',
                width: '100%',
                maxHeight: '80vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--fg)' }}>
                  Version {selectedVersion.version}
                </h3>
                <button
                  onClick={() => setShowVersionPopup(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    color: 'var(--fg-muted)',
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ width: '20px', height: '20px' }}
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ padding: '1rem' }}>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--fg-muted)',
                    marginBottom: '1rem',
                  }}
                >
                  {new Date(selectedVersion.createdAt).toLocaleString()}
                </p>
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    padding: '1rem',
                    borderRadius: '0.25rem',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '50vh',
                    overflow: 'auto',
                  }}
                >
                  {selectedVersionContent}
                </div>
              </div>
              <div
                style={{
                  padding: '1rem',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                }}
              >
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedVersionContent);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    color: 'var(--fg)',
                    fontSize: '0.875rem',
                  }}
                >
                  Copy
                </button>
                <button
                  onClick={() => setShowVersionPopup(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--amber)',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    color: 'var(--bg)',
                    fontSize: '0.875rem',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // EDIT STATE
  // ═══════════════════════════════════════════════════════════
  if (state === 'edit' && dropData && decryptedContent) {
    return (
      <>
        <header className="page-header amber">
          <a href="/">dead-drop.xyz</a>
        </header>
        <main className="main-container">
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
                <PasswordInput label="Admin Password" id="edit-pwd" placeholder="required" />
              )}

              <div className="form-group">
                <textarea
                  id="edit-content"
                  defaultValue={decryptedContent}
                  className="form-textarea"
                  rows={8}
                  autoFocus
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
            <nav className="footer-nav">
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
            <span style={{ opacity: 0.7 }}>
              ©{' '}
              <a
                href="https://ghostgrammer.xyz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit' }}
              >
                ghostgrammer.xyz
              </a>
            </span>
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
        <header className="page-header amber">
          <a href="/">dead-drop.xyz</a>
        </header>
        <main className="main-container">
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
                <PasswordInput label="Admin Password" id="delete-pwd" placeholder="required" />
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
            <nav className="footer-nav">
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
            <span style={{ opacity: 0.7 }}>
              ©{' '}
              <a
                href="https://ghostgrammer.xyz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit' }}
              >
                ghostgrammer.xyz
              </a>
            </span>
          </footer>
        </main>
      </>
    );
  }

  // Fallback
  return null;
}
// Cache bust: 1776629619
