import {
  generateSalt,
  generateIV,
  sha256,
  deriveKey,
  encrypt,
  decrypt,
  computeDropId,
  computeProtectedAdminHash,
  computePublicAdminHash,
  normalizeDropName,
  validateDropName,
  type DropTier,
  type DropVisibility,
} from '@dead-drop/engine';

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
  visibility: 'protected';
  payload: string;
  salt: string;
  iv: string;
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
  adminHash: string;
}

/**
 * Create drop data for API submission
 */
export async function createDropData(
  name: string,
  password: string,
  content: DropContentPayload,
  visibility: 'protected',
  tier: DropTier
): Promise<EncryptedDropData>;
export async function createDropData(
  name: string,
  password: string,
  content: DropContentPayload,
  visibility: 'public',
  tier: DropTier
): Promise<PublicDropData>;
export async function createDropData(
  name: string,
  password: string,
  content: DropContentPayload,
  visibility: DropVisibility,
  tier: DropTier
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

  if (visibility === 'protected') {
    return createProtectedDropData(id, normalizedName, password, contentJson);
  } else {
    return createPublicDropData(id, normalizedName, password, contentJson);
  }
}

/**
 * Create protected drop data with client-side encryption
 */
async function createProtectedDropData(
  id: string,
  normalizedName: string,
  password: string,
  contentJson: string
): Promise<EncryptedDropData> {
  // Generate cryptographic parameters
  const salt = generateSalt();
  const iv = generateIV();

  // Compute content hash
  const contentHash = await sha256(contentJson);

  // Derive encryption key from password
  const key = await deriveKey(password, salt);

  // Encrypt content
  const payload = await encrypt(contentJson, key, iv);

  return {
    id,
    nameLength: normalizedName.length,
    visibility: 'protected',
    payload,
    salt,
    iv,
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
  contentJson: string
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
    adminHash,
  };
}

/**
 * Decrypt a protected drop
 */
export async function decryptDrop(
  payload: string,
  password: string,
  salt: string,
  iv: string
): Promise<DropContentPayload> {
  // Derive key from password
  const key = await deriveKey(password, salt);

  // Decrypt content
  const contentJson = await decrypt(payload, key, iv);

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
 * Verify admin password for a protected drop
 */
export async function verifyProtectedPassword(
  content: DropContentPayload,
  _password: string,
  storedAdminHash: string,
  pepper: string
): Promise<boolean> {
  const contentJson = JSON.stringify(content);
  const contentHash = await sha256(contentJson);
  const computedHash = await computeProtectedAdminHash(contentHash, pepper);
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
