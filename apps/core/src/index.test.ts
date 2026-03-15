import { describe, it, expect } from 'vitest';
import { APP_NAME, EDITION } from './index.js';

describe('core app', () => {
  it('should export APP_NAME', () => {
    expect(APP_NAME).toBe('dead-drop (core)');
  });

  it('should export EDITION', () => {
    expect(EDITION).toBe('core');
  });
});
