import { describe, it, expect, beforeEach } from 'vitest';
import { createApiApp } from './index.js';
import type { AppEnv } from './types.js';
import type { Hono } from 'hono';

interface HealthResponse {
  status: string;
  timestamp: string;
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, unknown>;
}

describe('API App', () => {
  let app: Hono<AppEnv>;

  beforeEach(() => {
    app = createApiApp();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await app.request('/api/health');
      expect(res.status).toBe(200);

      const data = (await res.json()) as HealthResponse;
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.timestamp).toBe('string');
    });

    it('should return a valid ISO 8601 timestamp', async () => {
      const res = await app.request('/api/health');
      const data = (await res.json()) as HealthResponse;

      const timestamp = new Date(data.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('GET /api/docs', () => {
    it('should return Swagger UI HTML', async () => {
      const res = await app.request('/api/docs');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('SwaggerUIBundle');
      expect(html).toContain('dead-drop API Documentation');
    });

    it('should include OpenAPI URL in the HTML', async () => {
      const res = await app.request('/api/docs');
      const html = await res.text();

      expect(html).toContain('/api/docs/openapi.json');
    });
  });

  describe('GET /api/docs/openapi.json', () => {
    it('should return OpenAPI specification', async () => {
      const res = await app.request('/api/docs/openapi.json');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const spec = (await res.json()) as OpenAPISpec;
      expect(spec).toHaveProperty('openapi', '3.0.0');
      expect(spec).toHaveProperty('info');
      expect(spec.info).toHaveProperty('title', 'dead-drop API');
      expect(spec.info).toHaveProperty('version', '1.0.0');
    });

    it('should include health endpoint in paths', async () => {
      const res = await app.request('/api/docs/openapi.json');
      const spec = (await res.json()) as OpenAPISpec;

      expect(spec.paths).toHaveProperty('/api/health');
      expect(spec.paths['/api/health']).toHaveProperty('get');
    });

    it('should include docs endpoints in paths', async () => {
      const res = await app.request('/api/docs/openapi.json');
      const spec = (await res.json()) as OpenAPISpec;

      expect(spec.paths).toHaveProperty('/api/docs');
      expect(spec.paths).toHaveProperty('/api/docs/openapi.json');
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for unknown API routes', async () => {
      const res = await app.request('/api/unknown');
      // Hono returns 404 by default for unmatched routes
      expect(res.status).toBe(404);
    });
  });

  describe('CORS', () => {
    it('should allow all origins', async () => {
      const res = await app.request('/api/health', {
        headers: {
          Origin: 'https://example.com',
        },
      });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should allow OPTIONS requests', async () => {
      const res = await app.request('/api/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
        },
      });
      expect(res.status).toBe(204);
    });
  });
});
