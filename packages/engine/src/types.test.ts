import { describe, it, expect } from 'vitest';
import {
  textPayloadSchema,
  filePayloadSchema,
  dropContentPayloadSchema,
  dropVisibilitySchema,
  dropTierSchema,
  paymentStatusSchema,
  auditActionSchema,
  isTextPayload,
  isFilePayload,
  type TextPayload,
  type FilePayload,
  type DropContentPayload,
} from './types.js';

describe('textPayloadSchema', () => {
  it('should validate valid text payload', () => {
    const result = textPayloadSchema.safeParse({
      type: 'text',
      content: 'Hello, World!',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('text');
      expect(result.data.content).toBe('Hello, World!');
    }
  });

  it('should accept empty content', () => {
    const result = textPayloadSchema.safeParse({
      type: 'text',
      content: '',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing type', () => {
    const result = textPayloadSchema.safeParse({
      content: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong type', () => {
    const result = textPayloadSchema.safeParse({
      type: 'file',
      content: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing content', () => {
    const result = textPayloadSchema.safeParse({
      type: 'text',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-string content', () => {
    const result = textPayloadSchema.safeParse({
      type: 'text',
      content: 123,
    });
    expect(result.success).toBe(false);
  });
});

describe('filePayloadSchema', () => {
  it('should validate valid file payload', () => {
    const result = filePayloadSchema.safeParse({
      type: 'file',
      mime: 'text/plain',
      name: 'test.txt',
      data: 'SGVsbG8gV29ybGQh',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('file');
      expect(result.data.mime).toBe('text/plain');
      expect(result.data.name).toBe('test.txt');
      expect(result.data.data).toBe('SGVsbG8gV29ybGQh');
    }
  });

  it('should accept various mime types', () => {
    const mimeTypes = ['text/plain', 'application/json', 'image/png', 'application/pdf'];
    for (const mime of mimeTypes) {
      const result = filePayloadSchema.safeParse({
        type: 'file',
        mime,
        name: 'test',
        data: 'abc',
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject missing fields', () => {
    const cases = [
      { type: 'file' },
      { type: 'file', mime: 'text/plain' },
      { type: 'file', mime: 'text/plain', name: 'test' },
    ];
    for (const testCase of cases) {
      const result = filePayloadSchema.safeParse(testCase);
      expect(result.success).toBe(false);
    }
  });

  it('should reject wrong type', () => {
    const result = filePayloadSchema.safeParse({
      type: 'text',
      mime: 'text/plain',
      name: 'test.txt',
      data: 'abc',
    });
    expect(result.success).toBe(false);
  });
});

describe('dropContentPayloadSchema', () => {
  it('should validate text payload', () => {
    const result = dropContentPayloadSchema.safeParse({
      type: 'text',
      content: 'Hello',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('text');
    }
  });

  it('should validate file payload', () => {
    const result = dropContentPayloadSchema.safeParse({
      type: 'file',
      mime: 'text/plain',
      name: 'test.txt',
      data: 'SGVsbG8=',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('file');
    }
  });

  it('should reject invalid payload type', () => {
    const result = dropContentPayloadSchema.safeParse({
      type: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing type', () => {
    const result = dropContentPayloadSchema.safeParse({
      content: 'Hello',
    });
    expect(result.success).toBe(false);
  });
});

describe('dropVisibilitySchema', () => {
  it('should accept "protected"', () => {
    const result = dropVisibilitySchema.safeParse('protected');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('protected');
    }
  });

  it('should accept "public"', () => {
    const result = dropVisibilitySchema.safeParse('public');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('public');
    }
  });

  it('should reject invalid values', () => {
    const invalidValues = ['private', 'hidden', 'open', '', 'PROTECTED', 'Public'];
    for (const value of invalidValues) {
      const result = dropVisibilitySchema.safeParse(value);
      expect(result.success).toBe(false);
    }
  });
});

describe('dropTierSchema', () => {
  it('should accept "free"', () => {
    const result = dropTierSchema.safeParse('free');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('free');
    }
  });

  it('should accept "deep"', () => {
    const result = dropTierSchema.safeParse('deep');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('deep');
    }
  });

  it('should reject invalid values', () => {
    const invalidValues = ['standard', 'premium', 'paid', '', 'FREE', 'Deep'];
    for (const value of invalidValues) {
      const result = dropTierSchema.safeParse(value);
      expect(result.success).toBe(false);
    }
  });
});

describe('paymentStatusSchema', () => {
  it('should accept "none"', () => {
    const result = paymentStatusSchema.safeParse('none');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('none');
    }
  });

  it('should accept "pending"', () => {
    const result = paymentStatusSchema.safeParse('pending');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('pending');
    }
  });

  it('should accept "completed"', () => {
    const result = paymentStatusSchema.safeParse('completed');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('completed');
    }
  });

  it('should reject invalid values', () => {
    const invalidValues = ['paid', 'done', '', 'NONE', 'Pending'];
    for (const value of invalidValues) {
      const result = paymentStatusSchema.safeParse(value);
      expect(result.success).toBe(false);
    }
  });
});

describe('auditActionSchema', () => {
  it('should accept "created"', () => {
    const result = auditActionSchema.safeParse('created');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('created');
    }
  });

  it('should accept "edited"', () => {
    const result = auditActionSchema.safeParse('edited');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('edited');
    }
  });

  it('should accept "deleted"', () => {
    const result = auditActionSchema.safeParse('deleted');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('deleted');
    }
  });

  it('should reject invalid values', () => {
    const invalidValues = ['update', 'remove', '', 'CREATED', 'Edited'];
    for (const value of invalidValues) {
      const result = auditActionSchema.safeParse(value);
      expect(result.success).toBe(false);
    }
  });
});

describe('isTextPayload', () => {
  it('should return true for text payload', () => {
    const payload: DropContentPayload = { type: 'text', content: 'Hello' };
    expect(isTextPayload(payload)).toBe(true);
  });

  it('should return false for file payload', () => {
    const payload: DropContentPayload = {
      type: 'file',
      mime: 'text/plain',
      name: 'test.txt',
      data: 'abc',
    };
    expect(isTextPayload(payload)).toBe(false);
  });

  it('should narrow type correctly', () => {
    const payload: DropContentPayload = { type: 'text', content: 'Hello' };
    if (isTextPayload(payload)) {
      // TypeScript should know payload is TextPayload
      expect(payload.content).toBe('Hello');
    }
  });
});

describe('isFilePayload', () => {
  it('should return true for file payload', () => {
    const payload: DropContentPayload = {
      type: 'file',
      mime: 'text/plain',
      name: 'test.txt',
      data: 'abc',
    };
    expect(isFilePayload(payload)).toBe(true);
  });

  it('should return false for text payload', () => {
    const payload: DropContentPayload = { type: 'text', content: 'Hello' };
    expect(isFilePayload(payload)).toBe(false);
  });

  it('should narrow type correctly', () => {
    const payload: DropContentPayload = {
      type: 'file',
      mime: 'text/plain',
      name: 'test.txt',
      data: 'abc',
    };
    if (isFilePayload(payload)) {
      // TypeScript should know payload is FilePayload
      expect(payload.mime).toBe('text/plain');
      expect(payload.name).toBe('test.txt');
      expect(payload.data).toBe('abc');
    }
  });
});

describe('type exports', () => {
  it('TextPayload type should match schema output', () => {
    const data: TextPayload = {
      type: 'text',
      content: 'Hello',
    };
    const result = textPayloadSchema.parse(data);
    expect(result).toEqual(data);
  });

  it('FilePayload type should match schema output', () => {
    const data: FilePayload = {
      type: 'file',
      mime: 'text/plain',
      name: 'test.txt',
      data: 'abc',
    };
    const result = filePayloadSchema.parse(data);
    expect(result).toEqual(data);
  });
});
