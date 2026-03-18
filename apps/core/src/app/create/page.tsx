'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  normalizeDropName,
  validateDropName,
  computeDropId,
  generateSalt,
  generateIV,
  sha256,
  deriveKey,
  encrypt,
  computePublicAdminHash,
} from '@dead-drop/engine';
import { API_URL } from '../../lib/config';

interface DropContent {
  type: 'text';
  content: string;
}

export default function CreatePage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visibility, setVisibility] = useState<'protected' | 'public'>('protected');
  const [content, setContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [shareableUrl, setShareableUrl] = useState('');

  const normalizedName = normalizeDropName(name);
  const validation = validateDropName(normalizedName, 12);

  const handleCreate = useCallback(async () => {
    if (!validation.valid) {
      setErrorMessage(validation.error ?? 'Invalid drop name');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (!content.trim()) {
      setErrorMessage('Content cannot be empty');
      return;
    }

    const contentSize = new TextEncoder().encode(content).length;
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
        content,
      };
      const contentJson = JSON.stringify(contentPayload);

      let payload: string;
      let iv: string | null = null;
      let contentHash: string | null = null;
      let adminHash: string | null = null;

      if (visibility === 'protected') {
        const key = await deriveKey(password, salt);
        iv = generateIV();
        payload = await encrypt(contentJson, key, iv);
        contentHash = await sha256(contentJson);
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
          contentHash,
          adminHash,
        }),
      });

      if (response.ok) {
        setShareableUrl(`${window.location.origin}/view#${normalizedName}`);
        setSuccess(true);
      } else if (response.status === 409) {
        setErrorMessage('Drop name already taken. Try another name.');
      } else {
        const error = (await response.json()) as { error?: { message?: string } };
        setErrorMessage(error.error?.message || 'Failed to create drop');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [normalizedName, password, confirmPassword, content, visibility, validation]);

  const handleReset = useCallback(() => {
    setName('');
    setPassword('');
    setConfirmPassword('');
    setContent('');
    setErrorMessage(null);
    setSuccess(false);
    setShareableUrl('');
  }, []);

  if (success) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl">
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

            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                Create Another
              </button>
              <Link
                href="/view"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors text-center"
              >
                View Drops
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            ← Back to home
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2">Create Drop</h1>
        <p className="text-gray-500 mb-8">Create a new encrypted drop</p>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          {/* Drop Name */}
          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Drop Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white font-mono focus:outline-none focus:border-green-500"
              placeholder="my-secret-drop-name"
            />
            <div className="flex justify-between mt-1">
              <span className="text-gray-500 text-xs">Normalized: {normalizedName || '-'}</span>
              <span className={`text-xs ${validation.valid ? 'text-green-500' : 'text-gray-500'}`}>
                {normalizedName.length}/12 min
              </span>
            </div>
          </div>

          {/* Visibility Toggle */}
          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Visibility</label>
            <div className="flex gap-2">
              <button
                onClick={() => setVisibility('protected')}
                className={`flex-1 px-4 py-2 rounded border transition-colors ${
                  visibility === 'protected'
                    ? 'bg-green-600 border-green-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                🔒 Protected
              </button>
              <button
                onClick={() => setVisibility('public')}
                className={`flex-1 px-4 py-2 rounded border transition-colors ${
                  visibility === 'public'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                👁 Public
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-1">
              {visibility === 'protected'
                ? 'Encrypted. Password required to read.'
                : 'Plaintext. Anyone can read, password to edit.'}
            </p>
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-green-500"
              placeholder="Minimum 8 characters"
            />
          </div>

          {/* Confirm Password */}
          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-green-500"
              placeholder="Confirm password"
            />
          </div>

          {/* Content */}
          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white font-mono min-h-32 focus:outline-none focus:border-green-500"
              placeholder="Enter your secret content..."
            />
            <p className="text-gray-500 text-xs mt-1">
              {content.length.toLocaleString()} / 10,000 characters
            </p>
          </div>

          {errorMessage && <div className="mb-4 text-red-500">{errorMessage}</div>}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleCreate}
              disabled={
                isCreating || !validation.valid || !password || !confirmPassword || !content
              }
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Drop'}
            </button>
            <Link
              href="/"
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
