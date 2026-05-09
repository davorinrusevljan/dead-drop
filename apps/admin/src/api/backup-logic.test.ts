import { describe, it, expect } from 'vitest';
import {
  buildR2Key,
  buildExportUrl,
  buildCfApiHeaders,
  buildExportRequestBody,
  buildPollRequestBody,
  parseExportResponse,
  type CloudflareApiResponse,
} from './backup-logic.js';

describe('backup-logic', () => {
  describe('buildR2Key', () => {
    it('should build R2 key with correct format', () => {
      const date = new Date('2025-05-09T14:30:45Z');
      const key = buildR2Key(date);
      expect(key).toBe('backups/20250509_143045_full.sql');
    });

    it('should pad single-digit month/day/hour/minute/second', () => {
      const date = new Date('2025-01-02T03:04:05Z');
      const key = buildR2Key(date);
      expect(key).toBe('backups/20250102_030405_full.sql');
    });

    it('should use current date when no argument', () => {
      const key = buildR2Key();
      expect(key).toMatch(/^backups\/\d{8}_\d{6}_full\.sql$/);
    });
  });

  describe('buildExportUrl', () => {
    it('should build correct CF API URL', () => {
      const url = buildExportUrl('acc123', 'db456');
      expect(url).toBe(
        'https://api.cloudflare.com/client/v4/accounts/acc123/d1/database/db456/export'
      );
    });
  });

  describe('buildCfApiHeaders', () => {
    it('should include auth header', () => {
      const headers = buildCfApiHeaders('my-token');
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer my-token',
      });
    });
  });

  describe('buildExportRequestBody', () => {
    it('should build polling format request', () => {
      const body = buildExportRequestBody();
      expect(body).toEqual({
        output_format: 'polling',
        dump_options: {
          no_data: false,
          no_schema: false,
        },
      });
    });
  });

  describe('buildPollRequestBody', () => {
    it('should include current_bookmark', () => {
      const body = buildPollRequestBody('bookmark-abc');
      expect(body).toEqual({
        output_format: 'polling',
        current_bookmark: 'bookmark-abc',
      });
    });
  });

  describe('parseExportResponse', () => {
    it('should parse successful immediate completion', () => {
      const body: CloudflareApiResponse = {
        success: true,
        result: {
          status: 'complete',
          at_bookmark: 'bk-1',
          result: {
            filename: 'export.sql',
            signed_url: 'https://example.com/download.sql',
          },
        },
      };

      const parsed = parseExportResponse(body);
      expect(parsed.status).toBe('complete');
      expect(parsed.signedUrl).toBe('https://example.com/download.sql');
      expect(parsed.filename).toBe('export.sql');
      expect(parsed.bookmark).toBe('bk-1');
    });

    it('should parse in-progress response with bookmark', () => {
      const body: CloudflareApiResponse = {
        success: true,
        result: {
          status: 'running',
          at_bookmark: 'bk-inprogress',
        },
      };

      const parsed = parseExportResponse(body);
      expect(parsed.status).toBe('running');
      expect(parsed.bookmark).toBe('bk-inprogress');
      expect(parsed.signedUrl).toBeNull();
    });

    it('should throw on API error', () => {
      const body: CloudflareApiResponse = {
        success: false,
        errors: [
          { code: 1000, message: 'Database not found' },
          { code: 1001, message: 'Access denied' },
        ],
      };

      expect(() => parseExportResponse(body)).toThrow(
        'CF API error: Database not found; Access denied'
      );
    });

    it('should throw on missing result', () => {
      const body: CloudflareApiResponse = {
        success: true,
      };

      expect(() => parseExportResponse(body)).toThrow('CF API error: no result in response');
    });

    it('should parse error status', () => {
      const body: CloudflareApiResponse = {
        success: true,
        result: {
          status: 'error',
          error: 'Export failed',
        },
      };

      const parsed = parseExportResponse(body);
      expect(parsed.status).toBe('error');
      expect(parsed.error).toBe('Export failed');
    });

    it('should handle missing optional fields gracefully', () => {
      const body: CloudflareApiResponse = {
        success: true,
        result: {
          status: 'complete',
        },
      };

      const parsed = parseExportResponse(body);
      expect(parsed.signedUrl).toBeNull();
      expect(parsed.filename).toBeNull();
      expect(parsed.bookmark).toBeNull();
      expect(parsed.messages).toEqual([]);
    });
  });
});
