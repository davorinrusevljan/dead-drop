/**
 * Security headers middleware for dead-drop Core API
 */

import type { MiddlewareHandler } from 'hono';

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
