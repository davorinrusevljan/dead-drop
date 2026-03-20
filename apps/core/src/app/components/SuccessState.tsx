'use client';

import { useState, useCallback } from 'react';

interface SuccessStateProps {
  dropName: string;
  onCreateAnother: () => void;
  className?: string;
}

export function SuccessState({ dropName, onCreateAnother, className = '' }: SuccessStateProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/#${dropName}` : '';

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  return (
    <div className={`space-y-8 text-center animate-fade-in-up ${className}`}>
      {/* Checkmark animation */}
      <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
        <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
        <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
      </svg>

      {/* Success message */}
      <div>
        <p className="text-lg font-medium mb-2">DROP CREATED</p>
        <p className="text-sm opacity-50">Share this link:</p>
      </div>

      {/* Shareable URL */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--accent)] rounded-lg p-4 animate-pulse-glow">
        <p className="font-mono text-sm break-all">{shareUrl}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 justify-center">
        <button onClick={copyUrl} className="btn-primary min-w-[140px]">
          {copied ? '✓ COPIED' : 'COPY LINK'}
        </button>
        <button onClick={onCreateAnother} className="btn-secondary">
          Create Another
        </button>
      </div>

      {/* Warning */}
      <p className="text-xs opacity-30 pt-4">⚠ Save your password. It cannot be recovered.</p>
    </div>
  );
}
