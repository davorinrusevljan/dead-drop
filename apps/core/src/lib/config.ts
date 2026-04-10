/**
 * API configuration
 * Uses environment variable for API URL with fallbacks
 */

// Extend Window interface for Cloudflare Pages runtime config
declare global {
  interface Window {
    ENV_API_URL?: string;
  }
}

// Server-side: use process.env
// Client-side: use NEXT_PUBLIC_ prefixed variable or window env
const getApiUrl = (): string => {
  // Check for runtime config (set by Cloudflare Pages)
  if (typeof window !== 'undefined' && window.ENV_API_URL) {
    return window.ENV_API_URL;
  }

  // Check for build-time env (Next.js public env)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Default to production API
  return 'https://api.dead-drop.xyz';
};

export const API_URL = getApiUrl();
