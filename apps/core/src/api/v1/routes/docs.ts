import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { v1OpenApiConfig } from '../openapi.js';

/**
 * Register documentation routes (Swagger UI and OpenAPI spec)
 */
export function registerDocsRoutes(app: any): void {
  // ===== OpenAPI spec endpoint =====
  const openapiRoute = createRoute({
    method: 'get',
    path: '/docs/openapi.json',
    tags: ['Documentation'],
    summary: 'OpenAPI specification',
    description: 'Returns the OpenAPI 3.1 specification for the v1 API',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.record(z.unknown()),
          },
        },
        description: 'OpenAPI specification',
      },
    },
  });
  app.openapi(openapiRoute, (c: any) => {
    return c.json(app.getOpenAPIDocument(v1OpenApiConfig));
  });

  // ===== Swagger UI endpoint =====
  const docsRoute = createRoute({
    method: 'get',
    path: '/docs',
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
  app.openapi(docsRoute, (c: any) => {
    const openapiUrl = new URL('/api/v1/docs/openapi.json', c.req.url).href;
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>dead-drop API v1 Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body { margin: 0; background: #fafafa; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({ url: "${openapiUrl}", dom_id: '#swagger-ui', presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset], layout: "BaseLayout" });
    }
  </script>
</body>
</html>`;
    return c.html(html, 200);
  });
}
