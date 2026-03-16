'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface DropData {
  id: string;
  tier: 'free' | 'deep';
  visibility: 'protected' | 'public';
  payload: string;
  salt: string;
  iv: string | null;
  expiresAt: string;
}

type PageState = 'loading' | 'not-found' | 'unlock' | 'view' | 'create' | 'edit';

export default function DropPage() {
  const params = useParams();
  const phrase = params?.phrase as string;

  const [state, setState] = useState<PageState>('loading');
  const [dropData] = useState<DropData | null>(null);
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch drop data on mount
  useEffect(() => {
    if (!phrase) return;

    const fetchDrop = async () => {
      try {
        // In real implementation, this would hash the phrase and call the API
        // For now, simulate not found
        await new Promise((resolve) => setTimeout(resolve, 500));
        setState('create');
      } catch {
        setState('not-found');
      }
    };

    fetchDrop();
  }, [phrase]);

  const handleUnlock = useCallback(async () => {
    if (!password || !dropData) return;

    // In real implementation, this would decrypt the content
    setError(null);
    setState('view');
  }, [password, dropData]);

  const handleCreate = useCallback(async () => {
    if (!content || !password) return;

    setError(null);
    // In real implementation, this would encrypt and create the drop
    setState('view');
  }, [content, password]);

  const handleEdit = useCallback(async () => {
    if (!content || !password) return;

    setError(null);
    // In real implementation, this would encrypt and update the drop
    setState('view');
  }, [content, password]);

  if (state === 'loading') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-gray-400 animate-pulse">Loading drop...</div>
      </main>
    );
  }

  if (state === 'not-found') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 max-w-2xl w-full">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Drop Not Found</h1>
          <p className="text-gray-400 mb-4">
            The drop you&apos;re looking for doesn&apos;t exist or has expired.
          </p>
          <a href="/" className="text-blue-500 hover:underline">
            Return home
          </a>
        </div>
      </main>
    );
  }

  if (state === 'unlock') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 max-w-2xl w-full">
          <h1 className="text-2xl font-bold mb-4">Protected Drop</h1>
          <p className="text-gray-400 mb-4">Enter the drop password to unlock this content.</p>

          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
              placeholder="Enter password"
            />
          </div>

          {error && <p className="text-red-500 mb-4">{error}</p>}

          <button
            onClick={handleUnlock}
            disabled={!password}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
          >
            Unlock
          </button>
        </div>
      </main>
    );
  }

  if (state === 'create') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 max-w-2xl w-full">
          <h1 className="text-2xl font-bold mb-4">Create Drop: {phrase}</h1>
          <p className="text-gray-400 mb-4">This phrase is available. Create a new drop.</p>

          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
              placeholder="Set a password"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white min-h-32"
              placeholder="Enter your secret content"
            />
          </div>

          {error && <p className="text-red-500 mb-4">{error}</p>}

          <div className="flex gap-4">
            <button
              onClick={handleCreate}
              disabled={!content || !password}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
            >
              Create Drop
            </button>
            <a
              href="/"
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Cancel
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (state === 'view') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 max-w-2xl w-full">
          <h1 className="text-2xl font-bold mb-4">Drop: {phrase}</h1>

          <div className="mb-4 text-sm text-gray-500">
            <span className="mr-4">Tier: {dropData?.tier ?? 'free'}</span>
            <span>Expires: {dropData?.expiresAt ?? '7 days'}</span>
          </div>

          <div className="bg-gray-800 rounded p-4 mb-4 min-h-32">
            <pre className="whitespace-pre-wrap text-white">{content || 'No content'}</pre>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setState('edit')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this drop?')) {
                  // In real implementation, delete the drop
                  window.location.href = '/';
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (state === 'edit') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 max-w-2xl w-full">
          <h1 className="text-2xl font-bold mb-4">Edit Drop: {phrase}</h1>

          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white min-h-32"
            />
          </div>

          {error && <p className="text-red-500 mb-4">{error}</p>}

          <div className="flex gap-4">
            <button
              onClick={handleEdit}
              disabled={!content}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={() => setState('view')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
