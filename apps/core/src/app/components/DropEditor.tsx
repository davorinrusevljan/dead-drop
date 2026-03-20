'use client';

import { useState, useCallback } from 'react';

interface DropEditorProps {
  dropName: string;
  initialContent: string;
  visibility: 'private' | 'public';
  onSave: (data: { content: string; password?: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  className?: string;
}

export function DropEditor({
  dropName,
  initialContent,
  visibility,
  onSave,
  onCancel,
  isLoading,
  error,
  className = '',
}: DropEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!content.trim()) {
        setLocalError('Content cannot be empty');
        return;
      }

      if (visibility === 'public' && !password) {
        setLocalError('Password required');
        return;
      }

      setLocalError(null);
      onSave({ content, password: visibility === 'public' ? password : undefined });
    },
    [content, password, visibility, onSave]
  );

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 animate-fade-in-up ${className}`}>
      {/* Header */}
      <div className="text-center">
        <span className="tag mb-2">EDITING</span>
        <p className="font-mono text-base mt-2" style={{ color: 'var(--accent)' }}>
          {dropName}
        </p>
      </div>

      {/* Password for public drops */}
      {visibility === 'public' && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full input-glow py-3 text-sm"
          placeholder="Admin password"
        />
      )}

      {/* Content textarea */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors min-h-36 resize-none"
        rows={8}
      />

      {/* Error message */}
      {displayError && (
        <p className="text-sm text-[var(--danger)] animate-fade-in">{displayError}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? 'SAVING...' : 'SAVE'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
