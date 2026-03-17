'use client';

import { useState, useCallback } from 'react';
import { TerminalInput } from '@dead-drop/ui';
import { validateDropPhrase } from '@dead-drop/engine';

export default function HomePage() {
  const [phrase, setPhrase] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'not-found' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePhraseSubmit = useCallback(async () => {
    // Validate phrase before submitting
    const validation = validateDropPhrase(phrase, 'free');
    if (!validation.valid) {
      setErrorMessage(validation.error ?? 'Invalid phrase');
      setStatus('error');
      return;
    }

    setErrorMessage(null);
    setStatus('loading');

    // In a real implementation, this would hash the phrase and check the API
    // For now, just demonstrate the flow
    try {
      // Simulated API check
      await new Promise((resolve) => setTimeout(resolve, 500));

      // For demo purposes, show not found state
      setStatus('not-found');
    } catch {
      setStatus('idle');
    }
  }, [phrase]);

  const handleCreateDrop = useCallback(() => {
    // Navigate to drop creation flow
    window.location.href = `/drop/${phrase}`;
  }, [phrase]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold mb-2 text-center">dead-drop</h1>
        <p className="text-gray-500 text-center mb-8">Privacy-focused, ephemeral data sharing</p>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="mb-4">
            <span className="text-green-500">$</span>
            <span className="text-gray-400 ml-2">Enter Drop Phrase</span>
          </div>

          <TerminalInput
            value={phrase}
            onChange={setPhrase}
            onSubmit={handlePhraseSubmit}
            placeholder="my-secret-phrase"
            disabled={status === 'loading'}
          />

          {status === 'loading' && (
            <div className="mt-4 text-gray-400">
              <span className="animate-pulse">Checking drop...</span>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="mt-4 text-red-500">{errorMessage}</div>
          )}

          {status === 'not-found' && (
            <div className="mt-4">
              <p className="text-yellow-500 mb-3">Drop not found. This phrase is available.</p>
              <button
                onClick={handleCreateDrop}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
              >
                Create Drop
              </button>
            </div>
          )}

          {status === 'found' && (
            <div className="mt-4">
              <p className="text-green-500 mb-3">Drop found!</p>
              <a
                href={`/drop/${phrase}`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded inline-block transition-colors"
              >
                View Drop
              </a>
            </div>
          )}
        </div>

        <div className="mt-8 text-gray-600 text-sm text-center">
          <p>Standard drops: Free, 10KB max, 7-day expiry</p>
          <p>Deep drops: $1, 4MB max, 90-day expiry</p>
        </div>
      </div>
    </main>
  );
}
