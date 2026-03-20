'use client';

import { useState, useCallback } from 'react';

interface CreateDropFormProps {
  dropName: string;
  onSubmit: (data: { visibility: 'private' | 'public'; password: string; content: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  className?: string;
}

export function CreateDropForm({
  dropName,
  onSubmit,
  onCancel,
  isLoading,
  error,
  className = '',
}: CreateDropFormProps) {
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [content, setContent] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const contentSize = new TextEncoder().encode(content).length;
  const maxSize = 10 * 1024; // 10KB

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
      if (!content.trim()) {
        setLocalError('Content cannot be empty');
        return;
      }
      if (contentSize > maxSize) {
        setLocalError('Content exceeds 10KB limit');
        return;
      }

      setLocalError(null);
      onSubmit({ visibility, password, content });
    },
    [visibility, password, confirmPassword, content, contentSize, maxSize, onSubmit]
  );

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 animate-fade-in-up ${className}`}>
      {/* Drop name header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="tag">AVAILABLE</span>
          <p className="font-mono text-lg mt-3" style={{ color: 'var(--accent)' }}>
            {dropName}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm opacity-30 hover:opacity-100 transition-opacity"
          aria-label="Cancel"
        >
          ✕
        </button>
      </div>

      {/* Visibility toggle */}
      <div className="flex gap-2">
        {(['private', 'public'] as const).map((v) => (
          <button
            key={v}
            type="button"
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

      {/* Password fields */}
      <div className="space-y-3">
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
      </div>

      {/* Content textarea */}
      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors min-h-36 resize-none"
          placeholder="Your secret..."
          rows={6}
        />
        <div className="text-xs opacity-30 text-right">
          {contentSize.toLocaleString()} / {maxSize.toLocaleString()} bytes
        </div>
      </div>

      {/* Error message */}
      {displayError && (
        <p className="text-sm text-[var(--danger)] animate-fade-in">{displayError}</p>
      )}

      {/* Submit buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading || !password || !confirmPassword || !content}
          className="btn-primary flex-1"
        >
          {isLoading ? 'CREATING...' : 'CREATE DROP'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
