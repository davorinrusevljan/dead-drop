import { describe, it, expect, beforeEach } from 'vitest';
import {
  signAdminJwt,
  verifyAdminJwt,
  extractJwtFromCookie,
  getAuthCookieOptions,
  getClearCookieOptions,
  AUTH_COOKIE_NAME,
} from './jwt.js';

describe('JWT Utilities', () => {
  const secret = 'test-secret-key-minimum-32-characters-long';
  const shortSecret = 'short';

  describe('signAdminJwt', () => {
    it('should sign a JWT with user payload', async () => {
      const token = await signAdminJwt({ userId: 1, role: 'admin' }, secret);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should sign different tokens for different users', async () => {
      const token1 = await signAdminJwt({ userId: 1, role: 'admin' }, secret);
      const token2 = await signAdminJwt({ userId: 2, role: 'admin' }, secret);
      expect(token1).not.toBe(token2);
    });

    it('should sign different tokens for different roles', async () => {
      const adminToken = await signAdminJwt({ userId: 1, role: 'admin' }, secret);
      const superadminToken = await signAdminJwt({ userId: 1, role: 'superadmin' }, secret);
      expect(adminToken).not.toBe(superadminToken);
    });
  });

  describe('verifyAdminJwt', () => {
    it('should verify a valid JWT', async () => {
      const token = await signAdminJwt({ userId: 1, role: 'admin' }, secret);
      const payload = await verifyAdminJwt(token, secret);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('1');
      expect(payload!.role).toBe('admin');
      expect(payload!.iat).toBeDefined();
      expect(payload!.exp).toBeDefined();
    });

    it('should return null for invalid token', async () => {
      const payload = await verifyAdminJwt('invalid-token', secret);
      expect(payload).toBeNull();
    });

    it('should return null for wrong secret', async () => {
      const token = await signAdminJwt({ userId: 1, role: 'admin' }, secret);
      const payload = await verifyAdminJwt(token, 'wrong-secret-key-minimum-32-characters');
      expect(payload).toBeNull();
    });

    it('should return null for malformed JWT', async () => {
      const payload = await verifyAdminJwt('not.a.jwt', secret);
      expect(payload).toBeNull();
    });

    it('should include superadmin role correctly', async () => {
      const token = await signAdminJwt({ userId: 2, role: 'superadmin' }, secret);
      const payload = await verifyAdminJwt(token, secret);
      expect(payload!.role).toBe('superadmin');
    });
  });

  describe('extractJwtFromCookie', () => {
    it('should extract token from cookie header', () => {
      const cookieHeader = `${AUTH_COOKIE_NAME}=abc123; other=value`;
      const token = extractJwtFromCookie(cookieHeader);
      expect(token).toBe('abc123');
    });

    it('should extract token when it is the only cookie', () => {
      const cookieHeader = `${AUTH_COOKIE_NAME}=xyz789`;
      const token = extractJwtFromCookie(cookieHeader);
      expect(token).toBe('xyz789');
    });

    it('should extract token when it is the last cookie', () => {
      const cookieHeader = `other=value; ${AUTH_COOKIE_NAME}=lasttoken`;
      const token = extractJwtFromCookie(cookieHeader);
      expect(token).toBe('lasttoken');
    });

    it('should return null for undefined header', () => {
      const token = extractJwtFromCookie(undefined);
      expect(token).toBeNull();
    });

    it('should return null for empty header', () => {
      const token = extractJwtFromCookie('');
      expect(token).toBeNull();
    });

    it('should return null when cookie not present', () => {
      const cookieHeader = 'other=value; another=cookie';
      const token = extractJwtFromCookie(cookieHeader);
      expect(token).toBeNull();
    });
  });

  describe('Cookie options', () => {
    it('should return correct auth cookie options', () => {
      const options = getAuthCookieOptions();
      expect(options).toContain('HttpOnly');
      expect(options).toContain('Secure');
      expect(options).toContain('SameSite=Strict');
      expect(options).toContain('Path=/');
      expect(options).toContain('Max-Age=');
    });

    it('should return correct clear cookie options', () => {
      const options = getClearCookieOptions();
      expect(options).toContain('HttpOnly');
      expect(options).toContain('Secure');
      expect(options).toContain('SameSite=Strict');
      expect(options).toContain('Path=/');
      expect(options).toContain('Max-Age=0');
    });
  });
});
