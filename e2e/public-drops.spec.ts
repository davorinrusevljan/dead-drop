import { test, expect } from '@playwright/test';

// Run tests serially to avoid shared state issues
test.describe.configure({ mode: 'serial' });

const API_URL = 'http://localhost:9090/api/v1';

// Helper functions using Web Crypto API (no external dependencies)
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  return bytesToHex(generateRandomBytes(16));
}

test.describe('Public Drop CRUD Operations', () => {
  let dropName: string;
  let dropId: string;
  let password: string;
  let salt: string;

  test('should create a public drop', async ({ request }) => {
    // Generate a unique drop name
    dropName = `public-test-${Date.now()}`;

    // Compute drop ID (SHA-256 of normalized name)
    const normalizedName = dropName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_.]/g, '');
    dropId = await sha256(normalizedName);

    // Generate admin password and hash
    password = 'test-admin-password';
    salt = generateSalt();
    const adminHash = await sha256(password + salt);

    // Content to store
    const content = { type: 'text', content: 'This is a public drop test message' };
    const contentJson = JSON.stringify(content);
    const payload = btoa(contentJson);

    // Create the drop via API
    const response = await request.post(`${API_URL}/drops`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        id: dropId,
        nameLength: normalizedName.length,
        visibility: 'public',
        payload,
        salt,
        mimeType: 'text/plain',
        adminHash,
        I_agree_with_terms_and_conditions: true,
      },
    });

    if (!response.ok()) {
      const errorData = await response.json();
      console.error('Create drop failed:', response.status(), JSON.stringify(errorData));
    }
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.tier).toBe('free');
  });

  test('should read a public drop (anyone can read)', async ({ request }) => {
    // Get the drop we just created
    const response = await request.get(
      `${API_URL}/drops/${dropId}?I_agree_with_terms_and_conditions=true`
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.visibility).toBe('public');
    expect(data.iv).toBeNull(); // Public drops don't have IV

    // Decode the content
    const contentJson = atob(data.payload);
    const content = JSON.parse(contentJson);
    expect(content.type).toBe('text');
    expect(content.content).toBe('This is a public drop test message');
  });

  test('should edit a public drop with correct admin password', async ({ request }) => {
    // New content
    const newContent = { type: 'text', content: 'Updated public drop content' };
    const contentJson = JSON.stringify(newContent);
    const payload = btoa(contentJson);

    // Update the drop with admin password
    const response = await request.put(`${API_URL}/drops/${dropId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        payload,
        adminPassword: password,
        I_agree_with_terms_and_conditions: true,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify the update
    const verifyResponse = await request.get(
      `${API_URL}/drops/${dropId}?I_agree_with_terms_and_conditions=true`
    );
    const verifyData = await verifyResponse.json();
    const verifyContent = JSON.parse(atob(verifyData.payload));
    expect(verifyContent.content).toBe('Updated public drop content');
  });

  test('should reject editing a public drop with wrong password', async ({ request }) => {
    const newContent = { type: 'text', content: 'This should not be saved' };
    const contentJson = JSON.stringify(newContent);
    const payload = btoa(contentJson);

    const response = await request.put(`${API_URL}/drops/${dropId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        payload,
        adminPassword: 'wrong-password',
        I_agree_with_terms_and_conditions: true,
      },
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  test('should reject editing a public drop with empty password', async ({ request }) => {
    const newContent = { type: 'text', content: 'This should not be saved' };
    const contentJson = JSON.stringify(newContent);
    const payload = btoa(contentJson);

    const response = await request.put(`${API_URL}/drops/${dropId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        payload,
        adminPassword: '',
        I_agree_with_terms_and_conditions: true,
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  test('should delete a public drop with correct admin password', async ({ request }) => {
    const response = await request.delete(`${API_URL}/drops/${dropId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        adminPassword: password,
        I_agree_with_terms_and_conditions: true,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should verify drop was deleted', async ({ request }) => {
    const response = await request.get(
      `${API_URL}/drops/${dropId}?I_agree_with_terms_and_conditions=true`
    );
    expect(response.status()).toBe(404);
  });

  test('should reject creating a public drop without adminHash', async ({ request }) => {
    const testName = `public-no-hash-${Date.now()}`;
    const normalizedName = testName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_.]/g, '');
    const testId = await sha256(normalizedName);
    const testSalt = generateSalt();

    const content = { type: 'text', content: 'Test content' };
    const contentJson = JSON.stringify(content);
    const payload = btoa(contentJson);

    // Try to create without adminHash
    const response = await request.post(`${API_URL}/drops`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        id: testId,
        nameLength: normalizedName.length,
        visibility: 'public',
        payload,
        salt: testSalt,
        mimeType: 'text/plain',
        adminHash: '', // Empty!
        I_agree_with_terms_and_conditions: true,
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('MISSING_ADMIN_HASH');
  });

  test('should reject deleting a public drop with empty password', async ({ request }) => {
    // First create a test drop
    const testName = `public-delete-test-${Date.now()}`;
    const normalizedName = testName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_.]/g, '');
    const testId = await sha256(normalizedName);
    const testSalt = generateSalt();
    const testPassword = 'delete-test-password';
    const testAdminHash = await sha256(testPassword + testSalt);

    const content = { type: 'text', content: 'Delete test content' };
    const contentJson = JSON.stringify(content);
    const payload = btoa(contentJson);

    await request.post(`${API_URL}/drops`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        id: testId,
        nameLength: normalizedName.length,
        visibility: 'public',
        payload,
        salt: testSalt,
        mimeType: 'text/plain',
        adminHash: testAdminHash,
        I_agree_with_terms_and_conditions: true,
      },
    });

    // Try to delete with empty password
    const response = await request.delete(`${API_URL}/drops/${testId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        adminPassword: '',
        I_agree_with_terms_and_conditions: true,
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
