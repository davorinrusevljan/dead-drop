'use client';

import { useState, useCallback } from 'react';

interface DeleteConfirmProps {
  dropName: string;
  visibility: 'private' | 'public';
  onConfirm: (password?: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  className?: string;
}

export function DeleteConfirm({
  dropName,
  visibility,
  onConfirm,
  onCancel,
  isLoading,
  error,
  className = '',
}: DeleteConfirmProps) {
  const [password, setPassword] = useState('');

  const handleConfirm = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onConfirm(visibility === 'public' ? password : undefined);
    },
    [visibility, password, onConfirm]
  );

  return (
    <form
      onSubmit={handleConfirm}
      className={`space-y-6 animate-fade-in-up text-center ${className}`}
    >
      {/* Warning */}
      <div className="text-[var(--danger)] text-lg font-medium">Delete this drop?</div>
      <p className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
        {dropName}
      </p>
      <p className="text-sm opacity-50">This cannot be undone.</p>

      {/* Password for public drops */}
      {visibility === 'public' && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full input-glow py-3 text-sm border-[var(--danger)]"
          placeholder="Admin password"
        />
      )}

      {/* Error message */}
      {error && <p className="text-sm text-[var(--danger)] animate-fade-in">{error}</p>}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isLoading || (visibility === 'public' && !password)}
          className="flex-1 py-3 rounded font-medium !bg-[var(--danger)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {isLoading ? 'DELETING...' : 'DELETE'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
