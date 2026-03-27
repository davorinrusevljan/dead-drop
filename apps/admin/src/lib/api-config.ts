/**
 * API base URL configuration
 * In production, API is on the same domain (via Cloudflare routing)
 * In development, API runs on a different port
 */
export const API_BASE_URL = 'http://localhost:9091';

/**
 * Helper to make authenticated API requests
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE_URL}${path}`;
  return fetch(url, {
    ...options,
    credentials: 'include',
    ...(['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || '') && {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }),
  });
}
