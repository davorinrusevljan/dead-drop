'use client';

import { useState, useCallback } from 'react';

interface DropViewerProps {
  dropName: string;
  content: string;
  visibility: 'private' | 'public';
  expiresAt: string;
  onEdit: () => void;
  onDelete: () => void;
  onViewAnother: () => void;
  className?: string;
}

export function DropViewer({
  dropName,
  content,
  visibility,
  expiresAt,
  onEdit,
  onDelete,
  onViewAnother,
  className = '',
}: DropViewerProps) {
  const [copied, setCopied] = useState(false);

  const copyContent = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className={`space-y-6 animate-fade-in-up ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <span className={`tag ${visibility === 'public' ? 'tag-danger' : ''}`}>
            {visibility.toUpperCase()}
          </span>
          <p className="font-mono text-base mt-2" style={{ color: 'var(--accent)' }}>
            {dropName}
          </p>
        </div>
        <span className="text-xs opacity-40">
          Expires {new Date(expiresAt).toLocaleDateString()}
        </span>
      </div>

      {/* Content */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-5 min-h-36 whitespace-pre-wrap text-sm leading-relaxed">
        {content}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap justify-center">
        <button onClick={copyContent} className="btn-secondary text-sm">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <button onClick={onEdit} className="btn-secondary text-sm">
          Edit
        </button>
        <button
          onClick={onDelete}
          className="btn-secondary text-sm !border-[var(--danger)] !text-[var(--danger)]"
        >
          Delete
        </button>
      </div>

      {/* View another */}
      <button
        onClick={onViewAnother}
        className="w-full text-sm opacity-30 hover:opacity-60 transition-opacity py-2"
      >
        View Another
      </button>
    </div>
  );
}
