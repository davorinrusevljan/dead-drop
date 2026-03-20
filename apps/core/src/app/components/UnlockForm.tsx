'use client';

import { useState, useCallback } from 'react';

interface UnlockFormProps {
  dropName: string;
  onUnlock: (password: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  className?: string;
}

export function UnlockForm({
  dropName,
  onUnlock,
  onCancel,
  isLoading,
  error,
  className = '',
}: UnlockFormProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (password) {
        onUnlock(password);
      }
    },
    [password, onUnlock]
  );

  return (
    <form onSubmit={handleSubmit} className={`space-y-8 animate-fade-in-up ${className}`}>
      {/* Header */}
      <div className="text-center">
        <span className="tag mb-4">ENCRYPTED</span>
        <p className="font-mono text-lg mt-4" style={{ color: 'var(--accent)' }}>
          {dropName}
        </p>
      </div>

      {/* Password input */}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full input-glow text-lg py-4 text-center"
        placeholder="Enter password"
        autoFocus
      />

      {/* Error message */}
      {error && <p className="text-sm text-[var(--danger)] text-center animate-fade-in">{error}</p>}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button type="submit" disabled={isLoading || !password} className="btn-primary flex-1">
          {isLoading ? 'DECRYPTING...' : 'UNLOCK'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
