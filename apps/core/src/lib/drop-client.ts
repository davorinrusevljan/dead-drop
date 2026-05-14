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
 * Decode a public drop payload.
 * Public drops store raw content directly.
 */
export function decodePublicDrop(payload: string): string {
  return payload;
}

/**
 * Decode a decrypted private drop payload.
 * Private drops encrypt raw content directly.
 */
export function decodePrivateDrop(decryptedPayload: string): string {
  return decryptedPayload;
}

/**
 * Create drop data for API submission
 */
export async function createDropData(
  name: string,
  password: string,
  content: string,
  visibility: 'private',
  tier: DropTier,
  algorithm?: EncryptionAlgorithm,
  mimeType?: MimeType
): Promise<EncryptedDropData>;
export async function createDropData(
  name: string,
  password: string,
  content: string,
  visibility: 'public',
  tier: DropTier,
  algorithm?: EncryptionAlgorithm,
  mimeType?: MimeType
): Promise<PublicDropData>;
export async function createDropData(
  name: string,
  password: string,
  content: string,
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

  if (visibility === 'private') {
    return createPrivateDropData(id, normalizedName, password, content, algorithm, mimeType);
  } else {
    return createPublicDropData(id, normalizedName, password, content, mimeType);
  }
}

/**
 * Create private drop data with client-side encryption
 */
async function createPrivateDropData(
  id: string,
  normalizedName: string,
  password: string,
  content: string,
  algorithm: EncryptionAlgorithm = 'pbkdf2-aes256-gcm-v1',
  mimeType: MimeType = 'text/plain'
): Promise<EncryptedDropData> {
  // Get the crypto provider for the specified algorithm
  const provider = cryptoRegistry.get(algorithm);

  // Generate cryptographic parameters
  const salt = provider.generateSalt();
  const iv = provider.generateIV();

  // Compute content hash
  const contentHash = await sha256(content);

  // Derive encryption key from password
  const key = await provider.deriveKey(password, salt);

  // Encrypt content
  const payload = await provider.encrypt(content, key, iv);

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
  content: string,
  mimeType: MimeType = 'text/plain'
): Promise<PublicDropData> {
  // Generate salt for admin hash
  const salt = generateSalt();

  // Compute admin hash
  const adminHash = await computePublicAdminHash(password, salt);

  return {
    id,
    nameLength: normalizedName.length,
    visibility: 'public',
    payload: content,
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
): Promise<string> {
  // Get the crypto provider for the specified algorithm
  const provider = cryptoRegistry.get(algorithm);

  // Derive key from password
  const key = await provider.deriveKey(password, salt, _params);

  // Decrypt content
  const decrypted = await provider.decrypt(payload, key, iv);

  // Handle old wrapper format
  return decodePrivateDrop(decrypted);
}

/**
 * Verify admin password for a private drop
 */
export async function verifyPrivatePassword(
  content: string,
  _password: string,
  storedAdminHash: string,
  pepper: string
): Promise<boolean> {
  const contentHash = await sha256(content);
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
  const response = await fetch(
    `${API_URL}/api/v1/drops/${dropId}/history?I_agree_with_terms_and_conditions=true`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch version list');
  }
  return response.json() as Promise<VersionListResponse>;
}

/**
 * Fetch a specific version of a drop
 */
export async function fetchVersion(dropId: string, version: number): Promise<VersionDataResponse> {
  const response = await fetch(
    `${API_URL}/api/v1/drops/${dropId}/history/${version}?I_agree_with_terms_and_conditions=true`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch version');
  }
  return response.json() as Promise<VersionDataResponse>;
}
