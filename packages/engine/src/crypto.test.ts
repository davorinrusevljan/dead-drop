import { describe, it, expect } from 'vitest';
import {
  generateRandomBytes,
  bytesToHex,
  hexToBytes,
  generateSalt,
  generateIV,
  sha256,
  deriveKey,
  encrypt,
  decrypt,
  computePrivateAdminHash,
  computePublicAdminHash,
  computeDropId,
} from './crypto.js';

describe('generateRandomBytes', () => {
  it('should generate bytes of the specified length', () => {
    const bytes = generateRandomBytes(16);
    expect(bytes).toHaveLength(16);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('should generate different values on each call', () => {
    const bytes1 = generateRandomBytes(16);
    const bytes2 = generateRandomBytes(16);
    expect(bytes1).not.toEqual(bytes2);
  });

  it('should generate bytes with values 0-255', () => {
    const bytes = generateRandomBytes(100);
    for (const byte of bytes) {
      expect(byte).toBeGreaterThanOrEqual(0);
      expect(byte).toBeLessThanOrEqual(255);
    }
  });

  it('should handle length of 0', () => {
    const bytes = generateRandomBytes(0);
    expect(bytes).toHaveLength(0);
  });

  it('should handle larger lengths', () => {
    const bytes = generateRandomBytes(1024);
    expect(bytes).toHaveLength(1024);
  });
});

describe('bytesToHex', () => {
  it('should convert bytes to hex string', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x0f, 0x10, 0xff]);
    expect(bytesToHex(bytes)).toBe('00010f10ff');
  });

  it('should pad single digit hex values', () => {
    const bytes = new Uint8Array([0x01, 0x0a, 0x0f]);
    expect(bytesToHex(bytes)).toBe('010a0f');
  });

  it('should handle empty array', () => {
    const bytes = new Uint8Array([]);
    expect(bytesToHex(bytes)).toBe('');
  });

  it('should handle all zeros', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00]);
    expect(bytesToHex(bytes)).toBe('000000');
  });

  it('should handle all max values', () => {
    const bytes = new Uint8Array([0xff, 0xff, 0xff]);
    expect(bytesToHex(bytes)).toBe('ffffff');
  });
});

describe('hexToBytes', () => {
  it('should convert hex string to bytes', () => {
    const bytes = hexToBytes('00010f10ff');
    expect(Array.from(bytes)).toEqual([0x00, 0x01, 0x0f, 0x10, 0xff]);
  });

  it('should handle empty string', () => {
    const bytes = hexToBytes('');
    expect(bytes).toHaveLength(0);
  });

  it('should handle uppercase hex', () => {
    const bytes = hexToBytes('0A0B0C');
    expect(Array.from(bytes)).toEqual([0x0a, 0x0b, 0x0c]);
  });

  it('should handle mixed case hex', () => {
    const bytes = hexToBytes('0a0B0c');
    expect(Array.from(bytes)).toEqual([0x0a, 0x0b, 0x0c]);
  });

  it('should be inverse of bytesToHex', () => {
    const original = generateRandomBytes(32);
    const hex = bytesToHex(original);
    const converted = hexToBytes(hex);
    expect(Array.from(converted)).toEqual(Array.from(original));
  });
});

describe('generateSalt', () => {
  it('should generate a 32-character hex string (16 bytes)', () => {
    const salt = generateSalt();
    expect(salt).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(salt)).toBe(true);
  });

  it('should generate different salts on each call', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).not.toBe(salt2);
  });
});

describe('generateIV', () => {
  it('should generate a 24-character hex string (12 bytes)', () => {
    const iv = generateIV();
    expect(iv).toHaveLength(24);
    expect(/^[0-9a-f]+$/.test(iv)).toBe(true);
  });

  it('should generate different IVs on each call', () => {
    const iv1 = generateIV();
    const iv2 = generateIV();
    expect(iv1).not.toBe(iv2);
  });
});

describe('sha256', () => {
  it('should compute SHA-256 hash of a string', async () => {
    const hash = await sha256('hello');
    // Known SHA-256 of 'hello'
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('should return a 64-character hex string', async () => {
    const hash = await sha256('test data');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('should produce consistent hashes for same input', async () => {
    const hash1 = await sha256('test');
    const hash2 = await sha256('test');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', async () => {
    const hash1 = await sha256('test1');
    const hash2 = await sha256('test2');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', async () => {
    const hash = await sha256('');
    // Known SHA-256 of empty string
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should handle unicode characters', async () => {
    const hash = await sha256('hello world 🌍');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('should handle long strings', async () => {
    const longString = 'a'.repeat(10000);
    const hash = await sha256(longString);
    expect(hash).toHaveLength(64);
  });
});

describe('deriveKey', () => {
  it('should derive a CryptoKey from password and salt', async () => {
    const salt = generateSalt();
    const key = await deriveKey('my-password', salt);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.extractable).toBe(false);
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('should derive the same key for same password and salt', async () => {
    const salt = generateSalt();
    const key1 = await deriveKey('my-password', salt);
    const key2 = await deriveKey('my-password', salt);
    // Both keys should be able to encrypt/decrypt the same way
    const iv = generateIV();
    const plaintext = 'test message';
    const encrypted = await encrypt(plaintext, key1, iv);
    const decrypted = await decrypt(encrypted, key2, iv);
    expect(decrypted).toBe(plaintext);
  });

  it('should derive different keys for different passwords', async () => {
    const salt = generateSalt();
    const key1 = await deriveKey('password1', salt);
    const key2 = await deriveKey('password2', salt);
    // Different passwords should produce keys that can't decrypt each other's data
    const iv = generateIV();
    const plaintext = 'test message';
    const encrypted = await encrypt(plaintext, key1, iv);
    await expect(decrypt(encrypted, key2, iv)).rejects.toThrow();
  });

  it('should derive different keys for different salts', async () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const key1 = await deriveKey('my-password', salt1);
    const key2 = await deriveKey('my-password', salt2);
    // Different salts should produce keys that can't decrypt each other's data
    const iv = generateIV();
    const plaintext = 'test message';
    const encrypted = await encrypt(plaintext, key1, iv);
    await expect(decrypt(encrypted, key2, iv)).rejects.toThrow();
  });
});

describe('encrypt and decrypt', () => {
  it('should encrypt and decrypt data successfully', async () => {
    const salt = generateSalt();
    const key = await deriveKey('my-password', salt);
    const iv = generateIV();
    const plaintext = 'Hello, World!';

    const ciphertext = await encrypt(plaintext, key, iv);
    const decrypted = await decrypt(ciphertext, key, iv);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext with different IVs', async () => {
    const salt = generateSalt();
    const key = await deriveKey('my-password', salt);
    const iv1 = generateIV();
    const iv2 = generateIV();
    const plaintext = 'Same message';

    const ciphertext1 = await encrypt(plaintext, key, iv1);
    const ciphertext2 = await encrypt(plaintext, key, iv2);

    expect(ciphertext1).not.toBe(ciphertext2);
  });

  it('should fail to decrypt with wrong key', async () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const key1 = await deriveKey('password1', salt1);
    const key2 = await deriveKey('password2', salt2);
    const iv = generateIV();
    const plaintext = 'Secret message';

    const ciphertext = await encrypt(plaintext, key1, iv);

    await expect(decrypt(ciphertext, key2, iv)).rejects.toThrow();
  });

  it('should fail to decrypt with wrong IV', async () => {
    const salt = generateSalt();
    const key = await deriveKey('my-password', salt);
    const iv1 = generateIV();
    const iv2 = generateIV();
    const plaintext = 'Secret message';

    const ciphertext = await encrypt(plaintext, key, iv1);

    await expect(decrypt(ciphertext, key, iv2)).rejects.toThrow();
  });

  it('should handle empty plaintext', async () => {
    const salt = generateSalt();
    const key = await deriveKey('my-password', salt);
    const iv = generateIV();
    const plaintext = '';

    const ciphertext = await encrypt(plaintext, key, iv);
    const decrypted = await decrypt(ciphertext, key, iv);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle unicode in plaintext', async () => {
    const salt = generateSalt();
    const key = await deriveKey('my-password', salt);
    const iv = generateIV();
    const plaintext = 'Hello 🌍 World! 你好';

    const ciphertext = await encrypt(plaintext, key, iv);
    const decrypted = await decrypt(ciphertext, key, iv);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle long plaintext', async () => {
    const salt = generateSalt();
    const key = await deriveKey('my-password', salt);
    const iv = generateIV();
    const plaintext = 'a'.repeat(10000);

    const ciphertext = await encrypt(plaintext, key, iv);
    const decrypted = await decrypt(ciphertext, key, iv);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce hex-encoded ciphertext', async () => {
    const salt = generateSalt();
    const key = await deriveKey('my-password', salt);
    const iv = generateIV();
    const plaintext = 'test';

    const ciphertext = await encrypt(plaintext, key, iv);

    expect(/^[0-9a-f]+$/.test(ciphertext)).toBe(true);
  });
});

describe('computePrivateAdminHash', () => {
  it('should compute hash of contentHash + pepper', async () => {
    const contentHash = 'abc123';
    const pepper = 'secret-pepper';
    const hash = await computePrivateAdminHash(contentHash, pepper);

    // Should be SHA-256 of 'abc123secret-pepper'
    const expectedHash = await sha256('abc123secret-pepper');
    expect(hash).toBe(expectedHash);
  });

  it('should produce consistent hashes', async () => {
    const hash1 = await computePrivateAdminHash('content', 'pepper');
    const hash2 = await computePrivateAdminHash('content', 'pepper');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', async () => {
    const hash1 = await computePrivateAdminHash('content1', 'pepper');
    const hash2 = await computePrivateAdminHash('content2', 'pepper');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different peppers', async () => {
    const hash1 = await computePrivateAdminHash('content', 'pepper1');
    const hash2 = await computePrivateAdminHash('content', 'pepper2');
    expect(hash1).not.toBe(hash2);
  });
});

describe('computePublicAdminHash', () => {
  it('should compute hash of adminPassword + salt', async () => {
    const adminPassword = 'my-admin-password';
    const salt = 'abcd1234';
    const hash = await computePublicAdminHash(adminPassword, salt);

    // Should be SHA-256 of 'my-admin-passwordabcd1234'
    const expectedHash = await sha256('my-admin-passwordabcd1234');
    expect(hash).toBe(expectedHash);
  });

  it('should produce consistent hashes', async () => {
    const hash1 = await computePublicAdminHash('password', 'salt');
    const hash2 = await computePublicAdminHash('password', 'salt');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different passwords', async () => {
    const hash1 = await computePublicAdminHash('password1', 'salt');
    const hash2 = await computePublicAdminHash('password2', 'salt');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different salts', async () => {
    const hash1 = await computePublicAdminHash('password', 'salt1');
    const hash2 = await computePublicAdminHash('password', 'salt2');
    expect(hash1).not.toBe(hash2);
  });
});

describe('computeDropId', () => {
  it('should compute SHA-256 hash of the phrase', async () => {
    const id = await computeDropId('my-project');
    const expectedId = await sha256('my-project');
    expect(id).toBe(expectedId);
  });

  it('should return a 64-character hex string', async () => {
    const id = await computeDropId('test-phrase');
    expect(id).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(id)).toBe(true);
  });

  it('should produce consistent IDs for same phrase', async () => {
    const id1 = await computeDropId('my-project');
    const id2 = await computeDropId('my-project');
    expect(id1).toBe(id2);
  });

  it('should produce different IDs for different phrases', async () => {
    const id1 = await computeDropId('project-1');
    const id2 = await computeDropId('project-2');
    expect(id1).not.toBe(id2);
  });
});
