/**
 * Hybrid Storage Service
 * Routes between D1 (small payloads) and R2 (large files)
 */

/** Maximum size for D1 storage (10KB) */
const D1_MAX_SIZE = 10 * 1024;

/** Maximum size for Deep drops (4MB) */
const DEEP_MAX_SIZE = 4 * 1024 * 1024;

/**
 * Storage location result
 */
export type StorageLocation = 'd1' | 'r2';

/**
 * Storage decision result
 */
export interface StorageDecision {
  location: StorageLocation;
  canStore: boolean;
  reason?: string;
}

/**
 * Determine where to store data based on size and tier
 */
export function determineStorage(sizeBytes: number, tier: 'free' | 'deep'): StorageDecision {
  if (tier === 'free') {
    if (sizeBytes <= D1_MAX_SIZE) {
      return { location: 'd1', canStore: true };
    }
    return {
      location: 'd1',
      canStore: false,
      reason: `Payload exceeds ${(D1_MAX_SIZE / 1024).toFixed(0)}KB. Upgrade to Deep drop required.`,
    };
  }

  // Deep tier
  if (sizeBytes <= D1_MAX_SIZE) {
    return { location: 'd1', canStore: true };
  }
  if (sizeBytes <= DEEP_MAX_SIZE) {
    return { location: 'r2', canStore: true };
  }
  return {
    location: 'r2',
    canStore: false,
    reason: `Payload exceeds ${(DEEP_MAX_SIZE / 1024 / 1024).toFixed(0)}MB maximum.`,
  };
}

/**
 * Generate R2 object key
 */
export function generateR2Key(dropId: string, version: number): string {
  return `${dropId}/v${version}`;
}

/**
 * Parse R2 key to extract drop ID and version
 */
export function parseR2Key(key: string): { dropId: string; version: number } | null {
  const match = key.match(/^(.+)\/v(\d+)$/);
  if (!match?.[1] || !match[2]) return null;
  return {
    dropId: match[1],
    version: parseInt(match[2], 10),
  };
}

/**
 * Check if payload should use R2 storage
 */
export function shouldUseR2(sizeBytes: number): boolean {
  return sizeBytes > D1_MAX_SIZE;
}

/**
 * Storage constants
 */
export const STORAGE_LIMITS = {
  D1_MAX_SIZE,
  DEEP_MAX_SIZE,
  FREE_TIER_MAX: D1_MAX_SIZE,
  DEEP_TIER_MAX: DEEP_MAX_SIZE,
} as const;
