import { test, expect } from '@playwright/test';

// Helper functions using Web Crypto API (no external dependencies)
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computePublicAdminHash(adminPassword: string, salt: string): Promise<string> {
  return await sha256(adminPassword + salt);
}

test.describe('Public Drop Creation - Frontend Simulation', () => {
  test('should create a public drop using the same logic as the frontend', async ({ request }) => {
    // Simulate exactly what the frontend does in create/page.tsx
    const dropName = `test-public-frontend-sim-${Date.now()}`;
    const password = 'test-password-123';

    // Normalize name (same as frontend)
    const normalizedName = dropName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_.]/g, '');

    // Compute drop ID
    const dropId = await sha256(normalizedName);

    // Generate salt
    const salt = generateSalt();

    // Create content - new format: raw text string
    const payload = 'Test public drop content';

    // Compute admin hash for public drops
    const adminHash = await computePublicAdminHash(password, salt);

    // Build request body - EXACTLY as the frontend does
    const requestBody: Record<string, unknown> = {
      id: dropId,
      nameLength: normalizedName.length,
      tier: 'free',
      visibility: 'public',
      payload,
      salt,
      mimeType: 'text/plain',
      adminHash,
      I_agree_with_terms_and_conditions: true,
    };

    // Make the request
    const response = await request.post('http://localhost:9090/api/v1/drops', {
      headers: { 'Content-Type': 'application/json' },
      data: requestBody,
    });

    const responseText = await response.text();

    // Check the response
    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
    } else {
      const data = await response.json();
      throw new Error(`Failed to create drop: ${JSON.stringify(data)}`);
    }
  });

  test('should check if computePublicAdminHash returns valid hash', async () => {
    const password = 'test-password-123';
    const salt = generateSalt();

    const hash = await computePublicAdminHash(password, salt);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
    expect(hash).not.toBe('');
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
  });
});
