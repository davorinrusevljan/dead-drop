/**
 * Security headers middleware for dead-drop Core API
 */

import type { MiddlewareHandler } from 'hono';

/**
 * Rate limit headers (v1.0: headers sent, enforcement not implemented)
 * These headers prepare clients for future rate limiting without breaking changes.
 */
export const rateLimitHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  const res = c.res;
  if (!res) return;

  // v1.0: Send headers without actual enforcement
  // Clients can read and prepare for v1.1 when enforcement is added
  const now = Math.floor(Date.now() / 1000);
  const window = 3600; // 1 hour in seconds
  const reset = now + window;

  res.headers.set('X-RateLimit-Limit', '100');
  res.headers.set('X-RateLimit-Remaining', '100'); // Full for v1.0
  res.headers.set('X-RateLimit-Reset', reset.toString());
  res.headers.set('X-RateLimit-Window', window.toString());
};

/**
 * Apply security headers to all API responses
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  // Apply to the next response
  await next();

  // Get the response that will be returned
  const res = c.res;
  if (!res) return;

  // Remove Server header (security by obscurity)
  res.headers.delete('Server');

  // Security headers
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
};

/**
 * API version header middleware
 * Adds X-API-Version header to all responses
 */
export const versionHeader: MiddlewareHandler = async (c, next) => {
  await next();
  c.header('X-API-Version', '1.0.0');
};
