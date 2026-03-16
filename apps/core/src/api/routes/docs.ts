import { createRoute } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';

/**
 * OpenAPI docs route
 * GET /api/docs/openapi.json
 */
export const openapiRoute = createRoute({
  method: 'get',
  path: '/api/docs/openapi.json',
  tags: ['Documentation'],
  summary: 'OpenAPI specification',
  description: 'Returns the OpenAPI 3.0 specification for the API',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: {},
        },
      },
      description: 'OpenAPI specification',
    },
  },
});

/**
 * Swagger UI HTML template
 */
function getSwaggerUIHtml(openapiUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>dead-drop API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "${openapiUrl}",
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Swagger UI route
 * GET /api/docs
 */
export const docsRoute = createRoute({
  method: 'get',
  path: '/api/docs',
  tags: ['Documentation'],
  summary: 'Swagger UI',
  description: 'Interactive API documentation using Swagger UI',
  responses: {
    200: {
      content: {
        'text/html': {
          schema: {},
        },
      },
      description: 'Swagger UI HTML page',
    },
  },
});

/**
 * Swagger UI handler
 */
export function docsHandler(c: import('hono').Context<AppEnv>) {
  const openapiUrl = new URL('/api/docs/openapi.json', c.req.url).href;
  return c.html(getSwaggerUIHtml(openapiUrl), 200);
}
