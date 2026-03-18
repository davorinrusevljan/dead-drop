'use client';

import { useState, useEffect, useCallback } from 'react';
import { TerminalInput } from '@dead-drop/ui';
import { normalizeDropName, validateDropName, computeDropId } from '@dead-drop/engine';
import { API_URL } from '../lib/config';

type PageState = 'idle' | 'loading' | 'not-found' | 'found' | 'create' | 'unlock' | 'view';

interface DropData {
  id: string;
  tier: 'free' | 'deep';
  visibility: 'protected' | 'public';
  payload: string;
  salt: string;
  iv: string | null;
  expiresAt: string;
}

export default function HomePage() {
  const [inputValue, setInputValue] = useState('');
  const [normalizedName, setNormalizedName] = useState<string | null>(null);
  const [state, setState] = useState<PageState>('idle');
  const [dropData, setDropData] = useState<DropData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold mb-2 text-center">dead-drop</h1>
        <p className="text-gray-500 text-center mb-8">Privacy-focused, ephemeral data sharing</p>

        {/* Coming Soon Notice */}
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-6 text-center">
          <p className="text-yellow-400 font-medium">
            🚧 Coming Soon — This service is under active development and not yet functional.
          </p>
        </div>

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
            <p className="text-gray-400 mb-4">
              Drop creation is not yet implemented. Check back soon!
            </p>
            <button
              onClick={handleReset}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Try Another Name
            </button>
          </div>
        )}

        {state === 'found' && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <p className="text-green-500 mb-4">Drop found!</p>
            <p className="text-gray-400 mb-4">
              Drop viewing is not yet implemented. Check back soon!
            </p>
            <button
              onClick={handleReset}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Try Another Name
            </button>
          </div>
        )}

        {state === 'unlock' && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-2xl font-bold mb-4">Protected Drop</h2>
            <p className="text-gray-400 mb-4">
              Drop unlocking is not yet implemented. Check back soon!
            </p>
            <button
              onClick={handleReset}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Try Another Name
            </button>
          </div>
        )}

        {state === 'view' && dropData && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-2xl font-bold mb-4">Drop</h2>
            <div className="mb-4 text-sm text-gray-500">
              <span className="mr-4">Tier: {dropData.tier}</span>
              <span>Expires: {dropData.expiresAt}</span>
            </div>
            <p className="text-gray-400 mb-4">
              Drop viewing is not yet implemented. Check back soon!
            </p>
            <button
              onClick={handleReset}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Try Another Name
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
