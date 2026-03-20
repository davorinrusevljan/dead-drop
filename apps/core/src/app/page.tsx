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
  | 'not-found'
  | 'unlock'
  | 'create'
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
  const [dropName, setDropName] = useState('');
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);
  const [dropData, setDropData] = useState<DropData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [content, setContent] = useState('');
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const suggestions = generateDropNameSuggestions(4, 4);
    setSuggestedNames(suggestions);
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const normalized = normalizeDropName(hash);
      setDropName(normalized);
      checkDrop(normalized);
    } else {
      setDropName(suggestions[0]!);
    }
  }, []);

  useEffect(() => {
    if (dropName && state !== 'success') {
      window.history.replaceState(null, '', `#${dropName}`);
    }
  }, [dropName, state]);

  const normalizedName = normalizeDropName(dropName);
  const validation = validateDropName(normalizedName, 12);

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
        setState('not-found');
      } else if (response.ok) {
        const data = (await response.json()) as DropData;
        setDropData(data);
        if (data.visibility === 'public') {
          try {
            const contentJson = atob(data.payload);
            const parsed = JSON.parse(contentJson) as DropContent;
            setDecryptedContent(parsed.content);
          } catch {
            setError('Failed to decode drop content');
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

  const handleLandingSubmit = useCallback(() => {
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid drop name');
      return;
    }
    checkDrop(normalizedName);
  }, [validation, normalizedName, checkDrop]);

  const handleUnlock = useCallback(async () => {
    if (!dropData || !unlockPassword) return;
    setIsLoading(true);
    setError(null);
    try {
      const key = await deriveKey(unlockPassword, dropData.salt);
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
  }, [dropData, unlockPassword]);

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
    const contentSize = new TextEncoder().encode(content).length;
    if (contentSize > 10 * 1024) {
      setError('Content exceeds 10KB limit');
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
        setState('not-found');
      } else {
        const err = (await response.json()) as { error?: { message?: string } };
        setError(err.error?.message || 'Failed to create drop');
        setState('not-found');
      }
    } catch {
      setError('Network error');
      setState('not-found');
    } finally {
      setIsLoading(false);
    }
  }, [validation, normalizedName, password, confirmPassword, content, visibility]);

  const handleSaveEdit = useCallback(async () => {
    if (!dropData || !decryptedContent) return;
    if (!editContent.trim()) {
      setError('Content cannot be empty');
      return;
    }
    if (dropData.visibility === 'public' && !editPassword) {
      setError('Password required');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const contentPayload: DropContent = { type: 'text', content: editContent };
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
          adminPassword: dropData.visibility === 'public' ? editPassword : undefined,
        }),
      });
      if (response.ok) {
        setDecryptedContent(editContent);
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
  }, [dropData, decryptedContent, editContent, editPassword, unlockPassword, contentHash]);

  const handleDelete = useCallback(async () => {
    if (!dropData) return;
    if (dropData.visibility === 'public' && !editPassword) {
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
        body.adminPassword = editPassword;
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
  }, [dropData, editPassword, contentHash]);

  const handleReset = useCallback(() => {
    setState('landing');
    setDropData(null);
    setError(null);
    setDecryptedContent(null);
    setContentHash(null);
    setPassword('');
    setConfirmPassword('');
    setContent('');
    setUnlockPassword('');
    setEditContent('');
    setEditPassword('');
    setCopied(false);
    const suggestions = generateDropNameSuggestions(4, 4);
    setSuggestedNames(suggestions);
    setDropName(suggestions[0]!);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const copyUrl = useCallback(() => {
    const url = `${window.location.origin}/#${normalizedName}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [normalizedName]);

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-lg">
          {/* Header */}
          <header className="text-center mb-16 animate-fade-in-up">
            <h1
              className="text-2xl md:text-3xl font-bold mb-3 text-glow"
              style={{ color: 'var(--accent)' }}
            >
              dead-drop.xyz
            </h1>
            <p className="text-sm opacity-50 tracking-wide">SHARE SECRETS. LEAVE NO TRACE.</p>
          </header>

          {/* Landing State */}
          {state === 'landing' && (
            <div className="space-y-8 animate-fade-in-up stagger-1">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-[var(--accent-dim)] to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <input
                  type="text"
                  value={dropName}
                  onChange={(e) => setDropName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLandingSubmit()}
                  className="relative w-full input-glow text-lg py-4 focus:border-[var(--accent)]"
                  placeholder="enter-drop-name"
                  autoFocus
                />
                <button
                  onClick={handleLandingSubmit}
                  disabled={!validation.valid}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--accent)] opacity-40 hover:opacity-100 transition-all disabled:opacity-20 px-2"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-wrap gap-3 justify-center">
                {suggestedNames.slice(1).map((name, i) => (
                  <button
                    key={i}
                    onClick={() => setDropName(name)}
                    className="text-xs opacity-30 hover:opacity-100 hover:text-[var(--accent)] transition-all duration-200"
                  >
                    {name}
                  </button>
                ))}
              </div>

              <div className="text-center space-y-1 text-xs opacity-30">
                <span>{normalizedName.length}/12 min chars</span>
                {!validation.valid && normalizedName.length > 0 && (
                  <span className="text-[var(--danger)] opacity-60 ml-2">— {validation.error}</span>
                )}
              </div>

              <div className="pt-12 space-y-3 text-center text-xs opacity-20">
                <p>End-to-end encrypted. Zero-knowledge.</p>
                <p className="flex justify-center gap-6">
                  <span>Free: 10KB, 7 days</span>
                  <span className="opacity-50">Deep: 4MB, 90 days</span>
                </p>
              </div>
            </div>
          )}

          {/* Checking State */}
          {state === 'checking' && (
            <div className="text-center py-16 animate-fade-in">
              <div className="inline-flex items-center gap-3 opacity-60">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span>Scanning...</span>
              </div>
            </div>
          )}

          {/* Not Found - Create */}
          {state === 'not-found' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="text-center mb-8">
                <span className="tag mb-4">AVAILABLE</span>
                <p className="font-mono text-lg mt-4" style={{ color: 'var(--accent)' }}>
                  {normalizedName}
                </p>
              </div>

              <div className="flex gap-2">
                {(['private', 'public'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    className={`flex-1 py-3 px-4 rounded text-sm font-medium transition-all duration-200 ${
                      visibility === v
                        ? 'bg-[var(--accent)] text-[var(--bg-deep)]'
                        : 'border border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--fg-muted)]'
                    }`}
                  >
                    {v === 'private' ? '🔒 PRIVATE' : '👁 PUBLIC'}
                  </button>
                ))}
              </div>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full input-glow py-3 text-sm"
                placeholder="Password (min 8 chars)"
              />

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full input-glow py-3 text-sm"
                placeholder="Confirm password"
              />

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors min-h-36 resize-none"
                placeholder="Your secret..."
              />

              {error && <p className="text-sm text-[var(--danger)] animate-fade-in">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={
                    isLoading || !validation.valid || !password || !confirmPassword || !content
                  }
                  className="btn-primary flex-1"
                >
                  {isLoading ? 'CREATING...' : 'CREATE DROP'}
                </button>
                <button onClick={handleReset} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Unlock */}
          {state === 'unlock' && dropData && (
            <div className="space-y-8 animate-fade-in-up">
              <div className="text-center">
                <span className="tag mb-4">ENCRYPTED</span>
                <p className="font-mono text-lg mt-4" style={{ color: 'var(--accent)' }}>
                  {normalizedName}
                </p>
              </div>

              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                className="w-full input-glow text-lg py-4 text-center"
                placeholder="Enter password"
                autoFocus
              />

              {error && (
                <p className="text-sm text-[var(--danger)] text-center animate-fade-in">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleUnlock}
                  disabled={isLoading || !unlockPassword}
                  className="btn-primary flex-1"
                >
                  {isLoading ? 'DECRYPTING...' : 'UNLOCK'}
                </button>
                <button onClick={handleReset} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* View */}
          {state === 'view' && dropData && decryptedContent && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex justify-between items-center">
                <span className={`tag ${dropData.visibility === 'private' ? '' : 'tag-danger'}`}>
                  {dropData.visibility.toUpperCase()}
                </span>
                <span className="text-xs opacity-40">
                  Expires {new Date(dropData.expiresAt).toLocaleDateString()}
                </span>
              </div>

              <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-5 min-h-36 whitespace-pre-wrap text-sm leading-relaxed">
                {decryptedContent}
              </div>

              {error && <p className="text-sm text-[var(--danger)] animate-fade-in">{error}</p>}

              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  onClick={() => navigator.clipboard.writeText(decryptedContent)}
                  className="btn-secondary text-sm"
                >
                  Copy
                </button>
                <button
                  onClick={() => {
                    setEditContent(decryptedContent);
                    setEditPassword(dropData.visibility === 'public' ? '' : unlockPassword);
                    setState('edit');
                  }}
                  className="btn-secondary text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => setState('delete')}
                  className="btn-secondary text-sm !border-[var(--danger)] !text-[var(--danger)]"
                >
                  Delete
                </button>
              </div>

              <button
                onClick={handleReset}
                className="w-full text-sm opacity-30 hover:opacity-60 transition-opacity py-2"
              >
                View Another
              </button>
            </div>
          )}

          {/* Edit */}
          {state === 'edit' && dropData && (
            <div className="space-y-6 animate-fade-in-up">
              <p className="text-center opacity-50 text-sm">Editing drop</p>

              {dropData.visibility === 'public' && (
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full input-glow py-3 text-sm"
                  placeholder="Admin password"
                />
              )}

              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors min-h-36 resize-none"
              />

              {error && <p className="text-sm text-[var(--danger)] animate-fade-in">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={handleSaveEdit}
                  disabled={isLoading}
                  className="btn-primary flex-1"
                >
                  {isLoading ? 'SAVING...' : 'SAVE'}
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    setState('view');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Delete */}
          {state === 'delete' && dropData && (
            <div className="space-y-6 animate-fade-in-up text-center">
              <div className="text-[var(--danger)] text-lg font-medium">Delete this drop?</div>
              <p className="text-sm opacity-50">This cannot be undone.</p>

              {dropData.visibility === 'public' && (
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full input-glow py-3 text-sm border-[var(--danger)]"
                  placeholder="Admin password"
                />
              )}

              {error && <p className="text-sm text-[var(--danger)] animate-fade-in">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded font-medium !bg-[var(--danger)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {isLoading ? 'DELETING...' : 'DELETE'}
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    setState('view');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div className="space-y-8 text-center animate-fade-in-up">
              <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>

              <div>
                <p className="text-lg font-medium mb-2">DROP CREATED</p>
                <p className="text-sm opacity-50">Share this link:</p>
              </div>

              <div className="bg-[var(--bg-elevated)] border border-[var(--accent)] rounded-lg p-4 animate-pulse-glow">
                <p className="font-mono text-sm break-all">
                  {typeof window !== 'undefined' && `${window.location.origin}/#${normalizedName}`}
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <button onClick={copyUrl} className="btn-primary min-w-[140px]">
                  {copied ? '✓ COPIED' : 'COPY LINK'}
                </button>
                <button onClick={handleReset} className="btn-secondary">
                  Create Another
                </button>
              </div>

              <p className="text-xs opacity-30 pt-4">
                ⚠ Save your password. It cannot be recovered.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-xs opacity-20 hover:opacity-40 transition-opacity">
        © ghostgrammer.xyz
      </footer>
    </main>
  );
}
