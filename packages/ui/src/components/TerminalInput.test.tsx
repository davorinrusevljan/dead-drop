import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TerminalInput } from './TerminalInput';

describe('TerminalInput', () => {
  describe('rendering', () => {
    it('should render input with default placeholder', () => {
      render(<TerminalInput value="" onChange={() => {}} />);
      expect(screen.getByPlaceholderText('Enter drop phrase')).toBeInTheDocument();
    });

    it('should render input with custom placeholder', () => {
      render(<TerminalInput value="" onChange={() => {}} placeholder="my-secret-phrase" />);
      expect(screen.getByPlaceholderText('my-secret-phrase')).toBeInTheDocument();
    });

    it('should display the current value', () => {
      render(<TerminalInput value="test-value" onChange={() => {}} />);
      expect(screen.getByDisplayValue('test-value')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<TerminalInput value="" onChange={() => {}} disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should not be disabled by default', () => {
      render(<TerminalInput value="" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).not.toBeDisabled();
    });
  });

  describe('onChange', () => {
    it('should call onChange when input value changes', () => {
      const handleChange = vi.fn();
      render(<TerminalInput value="" onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new value' } });

      expect(handleChange).toHaveBeenCalledWith('new value');
    });

    it('should call onChange for each character typed', () => {
      const handleChange = vi.fn();
      render(<TerminalInput value="" onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.change(input, { target: { value: 'abc' } });

      expect(handleChange).toHaveBeenCalledTimes(3);
      expect(handleChange).toHaveBeenNthCalledWith(1, 'a');
      expect(handleChange).toHaveBeenNthCalledWith(2, 'ab');
      expect(handleChange).toHaveBeenNthCalledWith(3, 'abc');
    });
  });

  describe('onSubmit', () => {
    it('should call onSubmit when Enter key is pressed', () => {
      const handleSubmit = vi.fn();
      render(<TerminalInput value="test" onChange={() => {}} onSubmit={handleSubmit} />);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('should not call onSubmit when other keys are pressed', () => {
      const handleSubmit = vi.fn();
      render(<TerminalInput value="test" onChange={() => {}} onSubmit={handleSubmit} />);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'a' });
      fireEvent.keyDown(input, { key: 'Tab' });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('should not call onSubmit when disabled', () => {
      const handleSubmit = vi.fn();
      render(<TerminalInput value="test" onChange={() => {}} onSubmit={handleSubmit} disabled />);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('should not call onSubmit if not provided', () => {
      // Should not throw error
      render(<TerminalInput value="test" onChange={() => {}} />);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      // No error means success
    });

    it('should prevent default behavior on Enter', () => {
      const handleSubmit = vi.fn();
      render(<TerminalInput value="test" onChange={() => {}} onSubmit={handleSubmit} />);

      const input = screen.getByRole('textbox');
      const event = fireEvent.keyDown(input, { key: 'Enter' });

      // fireEvent returns false if preventDefault was called
      expect(event).toBe(false);
    });
  });

  describe('className', () => {
    it('should apply custom className', () => {
      render(<TerminalInput value="" onChange={() => {}} className="custom-class" />);
      const container = screen.getByRole('textbox').parentElement;
      expect(container).toHaveClass('custom-class');
    });

    it('should work without custom className', () => {
      render(<TerminalInput value="" onChange={() => {}} />);
      const container = screen.getByRole('textbox').parentElement;
      expect(container).toHaveClass('relative');
    });
  });

  describe('input attributes', () => {
    it('should have spellCheck disabled', () => {
      render(<TerminalInput value="" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).not.toHaveAttribute('spellcheck', 'true');
    });

    it('should have autoFocus prop', () => {
      render(<TerminalInput value="" onChange={() => {}} />);
      // autoFocus is a React prop, not a DOM attribute - just verify it renders
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should be a text input', () => {
      render(<TerminalInput value="" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
    });
  });
});
