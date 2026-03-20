'use client';

import { useState, useCallback } from 'react';

interface DropNameInputProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  isValid: boolean;
  errorMessage: string | null;
  minChars: number;
  className?: string;
  showGenerateButton?: boolean;
}

export function DropNameInput({
  value,
  onChange,
  onGenerate,
  isValid,
  errorMessage,
  minChars,
  className = '',
  showGenerateButton = true,
}: DropNameInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!hasInteracted) setHasInteracted(true);
      onChange(e.target.value);
    },
    [onChange, hasInteracted]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && isValid) {
        e.preventDefault();
        e.currentTarget.form?.requestSubmit();
      }
    },
    [isValid]
  );

  // Show validation only after interaction or if there's an error
  const showValidation = hasInteracted || errorMessage;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative group">
        {/* Subtle glow on focus */}
        <div
          className={`absolute -inset-1 bg-gradient-to-r from-transparent via-[var(--accent-dim)] to-transparent rounded-lg transition-opacity duration-300 ${
            isFocused ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div className="relative flex items-center">
          <input
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full input-glow text-lg py-4 pr-10 focus:border-[var(--accent)] transition-all duration-200"
            placeholder="enter-drop-name"
            autoFocus
            spellCheck={false}
          />

          {/* Arrow indicator */}
          <button
            type="submit"
            disabled={!isValid}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--accent)] opacity-40 hover:opacity-100 transition-all disabled:opacity-20 px-2"
            aria-label="Continue"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Generate Another button */}
      {showGenerateButton && !hasInteracted && (
        <button
          type="button"
          onClick={onGenerate}
          className="w-full py-2 text-sm opacity-40 hover:opacity-100 transition-opacity flex items-center justify-center gap-2 group"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="group-hover:rotate-180 transition-transform duration-500"
          >
            <rect x="2" y="2" width="8" height="8" rx="1" />
            <rect x="14" y="2" width="8" height="8" rx="1" />
            <rect x="2" y="14" width="8" height="8" rx="1" />
            <rect x="14" y="14" width="8" height="8" rx="1" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="18" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="18" r="1" fill="currentColor" />
            <circle cx="18" cy="18" r="1" fill="currentColor" />
          </svg>
          Generate Another
        </button>
      )}

      {/* Validation feedback */}
      {showValidation && (
        <div
          className={`text-center text-xs transition-all duration-200 ${
            isValid ? 'opacity-40' : 'text-[var(--danger)] opacity-80'
          }`}
        >
          <span>
            {value.length}/{minChars} minimum chars
          </span>
          {errorMessage && <span className="ml-2">— {errorMessage}</span>}
        </div>
      )}
    </div>
  );
}
