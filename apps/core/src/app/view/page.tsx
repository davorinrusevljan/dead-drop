'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TerminalInput } from '@dead-drop/ui';
import {
  normalizeDropName,
  validateDropName,
  computeDropId,
  deriveKey,
  decrypt,
} from '@dead-drop/engine';
import { API_URL } from '../../lib/config';

type PageState = 'idle' | 'loading' | 'not-found' | 'unlock' | 'view';

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

export default function ViewPage() {
  const [inputValue, setInputValue] = useState('');
  const [normalizedName, setNormalizedName] = useState<string | null>(null);
  const [state, setState] = useState<PageState>('idle');
  const [dropData, setDropData] = useState<DropData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    const validation = validateDropName(name, 3); // Min 3 for deep drops
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
        if (data.visibility === 'public') {
          // Auto-decode public drops
          try {
            const contentJson = atob(data.payload);
            const content = JSON.parse(contentJson) as DropContent;
            setDecryptedContent(content.content);
          } catch {
            setErrorMessage('Failed to decode drop content');
          }
        }
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

    const validation = validateDropName(normalized, 3);
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
    setUnlockPassword('');
    setDecryptedContent(null);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            ← Back to home
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2">View Drop</h1>
        <p className="text-gray-500 mb-8">Access an existing drop by name</p>

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
              <p>• Standard drops require name ≥ 12 chars</p>
              <p>• Deep drops require name ≥ 3 chars</p>
            </div>
          </div>
        )}

        {state === 'loading' && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="text-gray-400 animate-pulse">Checking drop...</div>
          </div>
        )}

        {state === 'not-found' && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-2xl font-bold mb-4 text-red-500">Drop Not Found</h2>
            <p className="text-gray-400 mb-4">
              The drop <span className="font-mono text-white">{normalizedName}</span> does not exist
              or has expired.
            </p>
            <div className="flex gap-4">
              <Link
                href="/create"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors text-center"
              >
                Create This Drop
              </Link>
              <button
                onClick={handleReset}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                Try Another
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
                View Another
              </button>
            </div>
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
