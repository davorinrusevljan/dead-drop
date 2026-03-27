/**
 * API base URL configuration
 * In production, use environment variable NEXT_PUBLIC_API_URL
 * In development, default to localhost
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9091';

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
