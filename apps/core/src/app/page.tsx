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
import {
  Logo,
  HeroSection,
  DropNameInput,
  CreateDropForm,
  SuccessState,
  DropViewer,
  DropEditor,
  UnlockForm,
  DeleteConfirm,
} from './components';

type AppState =
  | 'landing'
  | 'checking'
  | 'not-found'
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
  // App state
  const [state, setState] = useState<AppState>('landing');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drop name state
  const [dropName, setDropName] = useState('');

  // Drop data
  const [dropData, setDropData] = useState<DropData | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');

  // Initialize
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const normalized = normalizeDropName(hash);
      setDropName(normalized);
      checkDrop(normalized);
    } else {
      // Generate a default suggestion
      const suggestions = generateDropNameSuggestions(1, 4);
      setDropName(suggestions[0]!);
    }
  }, []);

  // Update URL hash
  useEffect(() => {
    if (dropName && state !== 'success') {
      window.history.replaceState(null, '', `#${dropName}`);
    }
  }, [dropName, state]);

  // Derived values
  const normalizedName = normalizeDropName(dropName);
  const validation = validateDropName(normalizedName, 12);

  // API: Check if drop exists
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

  // Action: Generate new name suggestion
  const handleGenerate = useCallback(() => {
    const suggestions = generateDropNameSuggestions(1, 4);
    setDropName(suggestions[0]!);
  }, []);

  // Action: Submit from landing page
  const handleLandingSubmit = useCallback(() => {
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid drop name');
      return;
    }
    checkDrop(normalizedName);
  }, [validation, normalizedName, checkDrop]);

  // Action: Unlock private drop
  const handleUnlock = useCallback(
    async (password: string) => {
      if (!dropData || !password) return;
      setIsLoading(true);
      setError(null);
      setUnlockPassword(password);
      try {
        const key = await deriveKey(password, dropData.salt);
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

  // Action: Create drop
  const handleCreate = useCallback(
    async (data: { visibility: 'private' | 'public'; password: string; content: string }) => {
      if (!validation.valid) {
        setError(validation.error ?? 'Invalid drop name');
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const dropId = await computeDropId(normalizedName);
        const salt = generateSalt();
        const contentPayload: DropContent = { type: 'text', content: data.content };
        const contentJson = JSON.stringify(contentPayload);
        let payload: string;
        let iv: string | null = null;
        let respContentHash: string | null = null;
        let adminHash: string | null = null;

        if (data.visibility === 'private') {
          const key = await deriveKey(data.password, salt);
          iv = generateIV();
          payload = await encrypt(contentJson, key, iv);
          respContentHash = await sha256(contentJson);
        } else {
          payload = btoa(contentJson);
          adminHash = await computePublicAdminHash(data.password, salt);
        }

        const response = await fetch(`${API_URL}/api/drops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: dropId,
            nameLength: normalizedName.length,
            tier: 'free',
            visibility: data.visibility,
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
    },
    [validation, normalizedName]
  );

  // Action: Save edit
  const handleSaveEdit = useCallback(
    async (data: { content: string; password?: string }) => {
      if (!dropData || !decryptedContent) return;
      setIsLoading(true);
      setError(null);
      try {
        const contentPayload: DropContent = { type: 'text', content: data.content };
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
            adminPassword: dropData.visibility === 'public' ? data.password : undefined,
          }),
        });

        if (response.ok) {
          setDecryptedContent(data.content);
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

  // Action: Delete drop
  const handleDelete = useCallback(
    async (password?: string) => {
      if (!dropData) return;
      if (dropData.visibility === 'public' && !password) {
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
          body.adminPassword = password;
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

  // Action: Reset to landing
  const handleReset = useCallback(() => {
    setState('landing');
    setDropData(null);
    setError(null);
    setDecryptedContent(null);
    setContentHash(null);
    setUnlockPassword('');
    const suggestions = generateDropNameSuggestions(1, 4);
    setDropName(suggestions[0]!);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Render states
  const renderContent = () => {
    switch (state) {
      case 'landing':
        return (
          <div className="space-y-12 animate-fade-in-up">
            <div className="text-center space-y-2">
              <Logo />
              <HeroSection />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLandingSubmit();
              }}
            >
              <DropNameInput
                value={dropName}
                onChange={setDropName}
                onGenerate={handleGenerate}
                isValid={validation.valid}
                errorMessage={validation.valid ? null : (validation.error ?? null)}
                minChars={12}
              />
            </form>

            <p className="text-center text-xs opacity-20">
              or enter an existing drop name to view it
            </p>
          </div>
        );

      case 'checking':
        return (
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
        );

      case 'not-found':
        return (
          <CreateDropForm
            dropName={normalizedName}
            onSubmit={handleCreate}
            onCancel={handleReset}
            isLoading={isLoading}
            error={error}
          />
        );

      case 'unlock':
        return dropData ? (
          <UnlockForm
            dropName={normalizedName}
            onUnlock={handleUnlock}
            onCancel={handleReset}
            isLoading={isLoading}
            error={error}
          />
        ) : null;

      case 'view':
        return dropData && decryptedContent ? (
          <DropViewer
            dropName={normalizedName}
            content={decryptedContent}
            visibility={dropData.visibility}
            expiresAt={dropData.expiresAt}
            onEdit={() => setState('edit')}
            onDelete={() => setState('delete')}
            onViewAnother={handleReset}
          />
        ) : null;

      case 'edit':
        return dropData && decryptedContent ? (
          <DropEditor
            dropName={normalizedName}
            initialContent={decryptedContent}
            visibility={dropData.visibility}
            onSave={handleSaveEdit}
            onCancel={() => {
              setError(null);
              setState('view');
            }}
            isLoading={isLoading}
            error={error}
          />
        ) : null;

      case 'delete':
        return dropData ? (
          <DeleteConfirm
            dropName={normalizedName}
            visibility={dropData.visibility}
            onConfirm={handleDelete}
            onCancel={() => {
              setError(null);
              setState('view');
            }}
            isLoading={isLoading}
            error={error}
          />
        ) : null;

      case 'success':
        return <SuccessState dropName={normalizedName} onCreateAnother={handleReset} />;

      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-lg">{renderContent()}</div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-xs opacity-20 hover:opacity-40 transition-opacity">
        © ghostgrammer.xyz
      </footer>
    </main>
  );
}
