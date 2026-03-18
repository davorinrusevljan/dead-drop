'use client';

import { useState, useEffect, useCallback } from 'react';
import { TerminalInput } from '@dead-drop/ui';
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
} from '@dead-drop/engine';
import { API_URL } from '../lib/config';

type PageState =
  | 'idle'
  | 'loading'
  | 'not-found'
  | 'found'
  | 'create'
  | 'unlock'
  | 'view'
  | 'success';

interface DropData {
  id: string;
  tier: 'free' | 'deep';
  visibility: 'protected' | 'public';
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
  const [inputValue, setInputValue] = useState('');
  const [normalizedName, setNormalizedName] = useState<string | null>(null);
  const [state, setState] = useState<PageState>('idle');
  const [dropData, setDropData] = useState<DropData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create form state
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');
  const [createVisibility, setCreateVisibility] = useState<'protected' | 'public'>('protected');
  const [createContent, setCreateContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Unlock form state
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);

  // Extract drop name from URL fragment on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const normalized = normalizeDropName(hash);
      setNormalizedName(normalized);
      setInputValue(normalized);
      checkDrop(normalized);
    }
  }, []);

  // Update URL fragment when normalizedName changes
  useEffect(() => {
    if (normalizedName) {
      window.history.replaceState(null, '', `#${normalizedName}`);
    }
  }, [normalizedName]);

  const checkDrop = useCallback(async (name: string) => {
    const validation = validateDropName(name, 12);
    if (!validation.valid) {
      setErrorMessage(validation.error ?? 'Invalid drop name');
      setState('idle');
      return;
    }

    setErrorMessage(null);
    setState('loading');

    try {
      const dropId = await computeDropId(name);
      const response = await fetch(`${API_URL}/api/drops/${dropId}`);

      if (response.status === 404) {
        setState('not-found');
      } else if (response.ok) {
        const data = (await response.json()) as DropData;
        setDropData(data);
        setState(data.visibility === 'protected' ? 'unlock' : 'view');
      } else {
        setErrorMessage('Failed to check drop. Please try again.');
        setState('idle');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
      setState('idle');
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const normalized = normalizeDropName(inputValue);
    setNormalizedName(normalized);

    const validation = validateDropName(normalized, 12);
    if (!validation.valid) {
      setErrorMessage(validation.error ?? 'Invalid drop name');
      setState('idle');
      return;
    }

    checkDrop(normalized);
  }, [inputValue, checkDrop]);

  const handleReset = useCallback(() => {
    setState('idle');
    setNormalizedName(null);
    setDropData(null);
    setErrorMessage(null);
    setInputValue('');
    setCreatePassword('');
    setCreateConfirmPassword('');
    setCreateContent('');
    setUnlockPassword('');
    setDecryptedContent(null);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const handleCreateDrop = useCallback(async () => {
    if (!normalizedName) return;

    // Validate
    if (createPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }
    if (createPassword !== createConfirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (!createContent.trim()) {
      setErrorMessage('Content cannot be empty');
      return;
    }

    // Check content size (10KB for free tier)
    const contentSize = new TextEncoder().encode(createContent).length;
    if (contentSize > 10 * 1024) {
      setErrorMessage('Content exceeds 10KB limit for Standard drops');
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const dropId = await computeDropId(normalizedName);
      const salt = generateSalt();

      const contentPayload: DropContent = {
        type: 'text',
        content: createContent,
      };
      const contentJson = JSON.stringify(contentPayload);

      let payload: string;
      let iv: string | null = null;
      let contentHash: string | null = null;
      let adminHash: string | null = null;

      if (createVisibility === 'protected') {
        // Encrypt content
        const key = await deriveKey(createPassword, salt);
        iv = generateIV();
        payload = await encrypt(contentJson, key, iv);
        contentHash = await sha256(contentJson);
      } else {
        // Public drop - base64 encode
        payload = btoa(contentJson);
        adminHash = await computePublicAdminHash(createPassword, salt);
      }

      const response = await fetch(`${API_URL}/api/drops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dropId,
          nameLength: normalizedName.length,
          tier: 'free',
          visibility: createVisibility,
          payload,
          salt,
          iv,
          contentHash,
          adminHash,
        }),
      });

      if (response.ok) {
        setState('success');
      } else if (response.status === 409) {
        setErrorMessage('Drop name already taken. Try another name.');
        setState('idle');
      } else {
        const error = (await response.json()) as { error?: { message?: string } };
        setErrorMessage(error.error?.message || 'Failed to create drop');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [normalizedName, createPassword, createConfirmPassword, createContent, createVisibility]);

  const handleUnlock = useCallback(async () => {
    if (!dropData || !unlockPassword) return;

    setIsUnlocking(true);
    setErrorMessage(null);

    try {
      const key = await deriveKey(unlockPassword, dropData.salt);
      const contentJson = await decrypt(dropData.payload, key, dropData.iv!);
      const content = JSON.parse(contentJson) as DropContent;
      setDecryptedContent(content.content);
      setState('view');
    } catch {
      setErrorMessage('Invalid password or corrupted data');
    } finally {
      setIsUnlocking(false);
    }
  }, [dropData, unlockPassword]);

  const handleViewPublic = useCallback(async () => {
    if (!dropData) return;

    try {
      const contentJson = atob(dropData.payload);
      const content = JSON.parse(contentJson) as DropContent;
      setDecryptedContent(content.content);
    } catch {
      setErrorMessage('Failed to decode drop content');
    }
  }, [dropData]);

  // Auto-load public drops
  useEffect(() => {
    if (state === 'view' && dropData?.visibility === 'public' && !decryptedContent) {
      handleViewPublic();
    }
  }, [state, dropData, decryptedContent, handleViewPublic]);

  const shareableUrl = normalizedName ? `${window.location.origin}/#${normalizedName}` : '';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold mb-2 text-center">dead-drop</h1>
        <p className="text-gray-500 text-center mb-8">Privacy-focused, ephemeral data sharing</p>

        {state === 'idle' && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="mb-4">
              <span className="text-green-500">$</span>
              <span className="text-gray-400 ml-2">Enter Drop Name</span>
            </div>

            <TerminalInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              placeholder="my-secret-drop-name"
              disabled={false}
            />

            {errorMessage && <div className="mt-4 text-red-500">{errorMessage}</div>}

            <div className="mt-4 text-gray-500 text-sm">
              <p>• Name must be at least 12 characters</p>
              <p>• Spaces will be converted to hyphens</p>
            </div>
          </div>
        )}

        {state === 'loading' && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="text-gray-400 animate-pulse">Checking drop...</div>
          </div>
        )}

        {state === 'not-found' && normalizedName && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-2xl font-bold mb-4">Create Drop</h2>
            <p className="text-yellow-500 mb-2">This drop name is available.</p>
            <p className="text-gray-600 text-sm mb-4 font-mono break-all">{normalizedName}</p>

            {/* Visibility Toggle */}
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Visibility</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreateVisibility('protected')}
                  className={`flex-1 px-4 py-2 rounded border transition-colors ${
                    createVisibility === 'protected'
                      ? 'bg-green-600 border-green-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  🔒 Protected
                </button>
                <button
                  onClick={() => setCreateVisibility('public')}
                  className={`flex-1 px-4 py-2 rounded border transition-colors ${
                    createVisibility === 'public'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  👁 Public
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {createVisibility === 'protected'
                  ? 'Encrypted. Password required to read.'
                  : 'Plaintext. Anyone can read, password to edit.'}
              </p>
            </div>

            {/* Password */}
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-green-500"
                placeholder="Minimum 8 characters"
              />
            </div>

            {/* Confirm Password */}
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Confirm Password</label>
              <input
                type="password"
                value={createConfirmPassword}
                onChange={(e) => setCreateConfirmPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-green-500"
                placeholder="Confirm password"
              />
            </div>

            {/* Content */}
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Content</label>
              <textarea
                value={createContent}
                onChange={(e) => setCreateContent(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white font-mono min-h-32 focus:outline-none focus:border-green-500"
                placeholder="Enter your secret content..."
              />
              <p className="text-gray-500 text-xs mt-1">
                {createContent.length.toLocaleString()} / 10,000 characters
              </p>
            </div>

            {errorMessage && <div className="mb-4 text-red-500">{errorMessage}</div>}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleCreateDrop}
                disabled={isCreating || !createPassword || !createConfirmPassword || !createContent}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create Drop'}
              </button>
              <button
                onClick={handleReset}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {state === 'unlock' && dropData && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-2xl font-bold mb-4">🔒 Protected Drop</h2>
            <p className="text-gray-400 mb-4">Enter the password to unlock this drop.</p>

            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-green-500"
                placeholder="Enter password"
                autoFocus
              />
            </div>

            {errorMessage && <div className="mb-4 text-red-500">{errorMessage}</div>}

            <div className="flex gap-4">
              <button
                onClick={handleUnlock}
                disabled={isUnlocking || !unlockPassword}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded transition-colors"
              >
                {isUnlocking ? 'Unlocking...' : 'Unlock'}
              </button>
              <button
                onClick={handleReset}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {state === 'view' && dropData && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">
                {dropData.visibility === 'protected' ? '🔒 Drop' : '👁 Drop'}
              </h2>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  dropData.tier === 'deep' ? 'bg-purple-600' : 'bg-gray-700'
                }`}
              >
                {dropData.tier === 'deep' ? 'Deep' : 'Standard'}
              </span>
            </div>

            <div className="mb-4 text-sm text-gray-500">
              <span className="mr-4">
                Expires: {new Date(dropData.expiresAt).toLocaleDateString()}
              </span>
            </div>

            <div className="bg-gray-800 rounded p-4 mb-4 min-h-32 font-mono text-sm whitespace-pre-wrap break-all">
              {decryptedContent || dropData.payload}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(decryptedContent || dropData.payload);
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                📋 Copy
              </button>
              <button
                onClick={handleReset}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                New Search
              </button>
            </div>
          </div>
        )}

        {state === 'success' && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-2xl font-bold mb-4 text-green-500">✅ Drop Created!</h2>

            <p className="text-gray-400 mb-4">Your drop has been created. Share this URL:</p>

            <div className="bg-gray-800 rounded p-4 mb-4 font-mono text-sm break-all">
              {shareableUrl}
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => navigator.clipboard.writeText(shareableUrl)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
              >
                📋 Copy URL
              </button>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-600 rounded p-4 mb-4">
              <p className="text-yellow-400 text-sm">
                ⚠️ <strong>Important:</strong> Save the password! Without it, you cannot access a
                protected drop.
              </p>
            </div>

            <button
              onClick={handleReset}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Create Another Drop
            </button>
          </div>
        )}

        <div className="mt-8 text-gray-600 text-sm text-center">
          <p>Standard drops: Free, 10KB max, 7-day expiry, name ≥ 12 chars</p>
          <p>Deep drops: $1, 4MB max, 90-day expiry, name ≥ 3 chars</p>
        </div>
      </div>
    </main>
  );
}
