import {
  generateSalt,
  sha256,
  computeDropId,
  computePrivateAdminHash,
  computePublicAdminHash,
  normalizeDropName,
  validateDropName,
  cryptoRegistry,
  type DropTier,
  type DropVisibility,
  type EncryptionAlgorithm,
  type EncryptionParams,
  type MimeType,
} from '@dead-drop/engine';
import { API_URL } from './config';

/**
 * Drop content payload for client-side encryption
 */
export type DropContentPayload =
  | { type: 'text'; content: string }
  | { type: 'file'; mime: string; name: string; data: string };

/**
 * Encrypted drop data ready for API submission
 */
export interface EncryptedDropData {
  id: string;
  nameLength: number;
  visibility: 'private';
  payload: string;
  salt: string;
  iv: string;
  encryptionAlgo: EncryptionAlgorithm;
  encryptionParams: EncryptionParams | null;
  mimeType: MimeType;
  contentHash: string;
}

/**
 * Public drop data ready for API submission
 */
export interface PublicDropData {
  id: string;
  nameLength: number;
  visibility: 'public';
  payload: string;
  salt: string;
  mimeType: MimeType;
  adminHash: string;
}

/**
 * Create drop data for API submission
 */
export async function createDropData(
  name: string,
  password: string,
  content: DropContentPayload,
  visibility: 'private',
  tier: DropTier,
  algorithm?: EncryptionAlgorithm,
  mimeType?: MimeType
): Promise<EncryptedDropData>;
export async function createDropData(
  name: string,
  password: string,
  content: DropContentPayload,
  visibility: 'public',
  tier: DropTier,
  algorithm?: EncryptionAlgorithm,
  mimeType?: MimeType
): Promise<PublicDropData>;
export async function createDropData(
  name: string,
  password: string,
  content: DropContentPayload,
  visibility: DropVisibility,
  tier: DropTier,
  algorithm: EncryptionAlgorithm = 'pbkdf2-aes256-gcm-v1',
  mimeType: MimeType = 'text/plain'
): Promise<EncryptedDropData | PublicDropData> {
  // Normalize and validate name
  const normalizedName = normalizeDropName(name);
  const minChars = tier === 'deep' ? 3 : 12;
  const validation = validateDropName(normalizedName, minChars);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Compute drop ID
  const id = await computeDropId(normalizedName);

  // Serialize content
  const contentJson = JSON.stringify(content);

  if (visibility === 'private') {
    return createPrivateDropData(id, normalizedName, password, contentJson, algorithm, mimeType);
  } else {
    return createPublicDropData(id, normalizedName, password, contentJson, mimeType);
  }
}

/**
 * Create private drop data with client-side encryption
 */
async function createPrivateDropData(
  id: string,
  normalizedName: string,
  password: string,
  contentJson: string,
  algorithm: EncryptionAlgorithm = 'pbkdf2-aes256-gcm-v1',
  mimeType: MimeType = 'text/plain'
): Promise<EncryptedDropData> {
  // Get the crypto provider for the specified algorithm
  const provider = cryptoRegistry.get(algorithm);

  // Generate cryptographic parameters
  const salt = provider.generateSalt();
  const iv = provider.generateIV();

  // Compute content hash
  const contentHash = await sha256(contentJson);

  // Derive encryption key from password
  const key = await provider.deriveKey(password, salt);

  // Encrypt content
  const payload = await provider.encrypt(contentJson, key, iv);

  return {
    id,
    nameLength: normalizedName.length,
    visibility: 'private',
    payload,
    salt,
    iv,
    encryptionAlgo: algorithm,
    encryptionParams: null,
    mimeType,
    contentHash,
  };
}

/**
 * Create public drop data (no encryption, just admin hash)
 */
async function createPublicDropData(
  id: string,
  normalizedName: string,
  password: string,
  contentJson: string,
  mimeType: MimeType = 'text/plain'
): Promise<PublicDropData> {
  // Generate salt for admin hash
  const salt = generateSalt();

  // Compute admin hash
  const adminHash = await computePublicAdminHash(password, salt);

  // Content is stored as plaintext (base64 encoded)
  const payload = btoa(contentJson);

  return {
    id,
    nameLength: normalizedName.length,
    visibility: 'public',
    payload,
    salt,
    mimeType,
    adminHash,
  };
}

/**
 * Decrypt a private drop
 */
export async function decryptDrop(
  payload: string,
  password: string,
  salt: string,
  iv: string,
  algorithm: EncryptionAlgorithm = 'pbkdf2-aes256-gcm-v1',
  _params?: EncryptionParams
): Promise<DropContentPayload> {
  // Get the crypto provider for the specified algorithm
  const provider = cryptoRegistry.get(algorithm);

  // Derive key from password
  const key = await provider.deriveKey(password, salt, _params);

  // Decrypt content
  const contentJson = await provider.decrypt(payload, key, iv);

  // Parse and return content
  return JSON.parse(contentJson) as DropContentPayload;
}

/**
 * Decrypt a public drop (no decryption needed, just decode)
 */
export function decodePublicDrop(payload: string): DropContentPayload {
  const contentJson = atob(payload);
  return JSON.parse(contentJson) as DropContentPayload;
}

/**
 * Verify admin password for a private drop
 */
export async function verifyPrivatePassword(
  content: DropContentPayload,
  _password: string,
  storedAdminHash: string,
  pepper: string
): Promise<boolean> {
  const contentJson = JSON.stringify(content);
  const contentHash = await sha256(contentJson);
  const computedHash = await computePrivateAdminHash(contentHash, pepper);
  return computedHash === storedAdminHash;
}

/**
 * Verify admin password for a public drop
 */
export async function verifyPublicPassword(
  password: string,
  salt: string,
  storedAdminHash: string
): Promise<boolean> {
  const computedHash = await computePublicAdminHash(password, salt);
  return computedHash === storedAdminHash;
}

/**
 * Serialize content payload to JSON
 */
export function serializeContent(content: DropContentPayload): string {
  return JSON.stringify(content);
}

/**
 * Parse content payload from JSON
 */
export function parseContent(json: string): DropContentPayload {
  return JSON.parse(json) as DropContentPayload;
}

/**
 * Version information for a drop
 */
export interface DropVersionInfo {
  version: number;
  createdAt: string;
}

/**
 * Version list response from API
 */
export interface VersionListResponse {
  versions: DropVersionInfo[];
  current: number;
  maxVersions: number;
}

/**
 * Version data response from API
 */
export interface VersionDataResponse {
  version: number;
  payload: string;
  iv: string | null;
  createdAt: string;
}

/**
 * Fetch the list of versions for a drop
 */
export async function fetchVersionList(dropId: string): Promise<VersionListResponse> {
  const response = await fetch(`${API_URL}/api/drops/${dropId}/history`);
  if (!response.ok) {
    throw new Error('Failed to fetch version list');
  }
  return response.json() as Promise<VersionListResponse>;
}

/**
 * Fetch a specific version of a drop
 */
export async function fetchVersion(dropId: string, version: number): Promise<VersionDataResponse> {
  const response = await fetch(`${API_URL}/api/drops/${dropId}/history/${version}`);
  if (!response.ok) {
    throw new Error('Failed to fetch version');
  }
  return response.json() as Promise<VersionDataResponse>;
}
