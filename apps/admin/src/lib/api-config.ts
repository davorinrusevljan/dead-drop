/**
 * API base URL configuration
 * In production, derive from current hostname or use environment variable
 * In development, default to localhost
 */
function getApiBaseUrl(): string {
  // Check for explicit environment variable first
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // In browser, derive from current hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Production: admin.dead-drop.xyz -> admin-api.dead-drop.xyz
    if (hostname === 'admin.dead-drop.xyz') {
      return 'https://admin-api.dead-drop.xyz';
    }

    // Pages.dev preview: dead-drop-admin.pages.dev -> dead-drop-admin-api.bytesmith.workers.dev
    if (hostname.includes('dead-drop-admin.pages.dev')) {
      return 'https://dead-drop-admin-api.bytesmith.workers.dev';
    }
  }

  // Default to localhost for development
  return 'http://localhost:9091';
}

export const API_BASE_URL = getApiBaseUrl();

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
