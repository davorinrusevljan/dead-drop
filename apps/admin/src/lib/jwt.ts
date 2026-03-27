import { SignJWT, jwtVerify } from 'jose';
import type { AdminJwtPayload, AdminRole } from '../api/schema.js';

/**
 * JWT expiration time (24 hours)
 */
const JWT_EXPIRATION = '24h';

/**
 * Cookie name for auth token
 */
export const AUTH_COOKIE_NAME = 'admin_auth_token';

/**
 * Create a signed JWT for admin user
 */
export async function signAdminJwt(
  payload: { userId: number; role: AdminRole },
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  const jwt = await new SignJWT({
    sub: String(payload.userId),
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(secretKey);

  return jwt;
}

/**
 * Verify and decode an admin JWT
 */
export async function verifyAdminJwt(
  token: string,
  secret: string
): Promise<AdminJwtPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

    if (
      typeof payload.sub !== 'string' ||
      (payload.role !== 'admin' && payload.role !== 'superadmin')
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      role: payload.role as AdminRole,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Extract JWT from cookie header
 */
export function extractJwtFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === AUTH_COOKIE_NAME && value) {
      return value;
    }
  }

  return null;
}

/**
 * Create cookie options for auth token
 * Uses SameSite=None; Secure for cross-origin (frontend and API on different domains)
 */
export function getAuthCookieOptions(): string {
  return `HttpOnly; SameSite=None; Secure; Path=/; Max-Age=${24 * 60 * 60}`;
}

/**
 * Create clear cookie options
 */
export function getClearCookieOptions(): string {
  return 'HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0';
}
