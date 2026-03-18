import { useRef, type KeyboardEvent } from 'react';

export interface TerminalInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Terminal-style input component for dead-drop name entry
 */
export function TerminalInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Enter drop name',
  disabled = false,
  className = '',
}: TerminalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !disabled) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-transparent border border-gray-700 rounded px-4 py-2 text-white font-mono focus:outline-none focus:border-green-500 disabled:opacity-50"
        spellCheck={false}
        autoFocus
      />
    </div>
  );
}
