import { describe, it, expect } from 'vitest';
import { APP_NAME, EDITION } from './index.js';

describe('saas app', () => {
  it('should export APP_NAME', () => {
    expect(APP_NAME).toBe('dead-drop (saas)');
  });

  it('should export EDITION', () => {
    expect(EDITION).toBe('saas');
  });
});
