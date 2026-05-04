import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../types.js';
import {
  historyListResponseSchema,
  historyVersionResponseSchema,
  errorResponseSchema,
} from '../openapi.js';
import {
  getDropById,
  getDropHistoryList,
  getDropHistoryVersion,
  TIER_VERSION_LIMITS,
} from '../../db.js';

// ===== History list endpoint =====
export const historyListRoute = createRoute({
  method: 'get',
  path: '/drops/{id}/history',
  tags: ['History'],
  summary: 'List drop history',
  description: 'Get a list of all versions of a drop.',
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      description: 'SHA-256 hash of the drop name',
      schema: { type: 'string' },
    },
    {
      name: 'I_agree_with_terms_and_conditions',
      in: 'query',
      required: true,
      description: 'Must be true to confirm agreement to terms and conditions',
      schema: { type: 'boolean' },
    },
  ],
  responses: {
    200: {
      content: { 'application/json': { schema: historyListResponseSchema } },
      description: 'List of versions',
    },
    403: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Terms not agreed',
    },
    404: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Drop not found',
    },
  },
});

// ===== History version endpoint =====
export const historyVersionRoute = createRoute({
  method: 'get',
  path: '/drops/{id}/history/{version}',
  tags: ['History'],
  summary: 'Get specific drop version',
  description: 'Get a specific version of a drop.',
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      description: 'SHA-256 hash of the drop name',
      schema: { type: 'string' },
    },
    {
      name: 'version',
      in: 'path',
      required: true,
      description: 'Version number',
      schema: { type: 'integer', minimum: 1 },
    },
    {
      name: 'I_agree_with_terms_and_conditions',
      in: 'query',
      required: true,
      description: 'Must be true to confirm agreement to terms and conditions',
      schema: { type: 'boolean' },
    },
  ],
  responses: {
    200: {
      content: { 'application/json': { schema: historyVersionResponseSchema } },
      description: 'Drop version data',
    },
    403: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Terms not agreed',
    },
    404: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Drop or version not found',
    },
  },
});

export function registerHistoryRoutes(app: OpenAPIHono<AppEnv>): void {
  app.openapi(historyListRoute, async (c) => {
    const { id } = c.req.param();
    const { I_agree_with_terms_and_conditions } = c.req.query();

    // Validate terms agreement
    if (I_agree_with_terms_and_conditions !== 'true') {
      return c.json(
        {
          error: {
            code: 'TERMS_NOT_AGREED',
            message:
              'You must agree to the terms and conditions. Set I_agree_with_terms_and_conditions=true.',
          },
        },
        403
      );
    }

    const db = c.env.DB;
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
    }

    const historyList = await getDropHistoryList(db, id);
    const versions = [
      { version: drop.version, createdAt: drop.createdAt.toISOString() },
      ...historyList.map((h) => ({ version: h.version, createdAt: h.createdAt.toISOString() })),
    ];

    return c.json(
      {
        versions,
        current: drop.version,
        maxVersions: TIER_VERSION_LIMITS[drop.tier] ?? 5,
      },
      200
    );
  });

  app.openapi(historyVersionRoute, async (c) => {
    const { id, version } = c.req.param();
    const { I_agree_with_terms_and_conditions } = c.req.query();

    // Validate terms agreement
    if (I_agree_with_terms_and_conditions !== 'true') {
      return c.json(
        {
          error: {
            code: 'TERMS_NOT_AGREED',
            message:
              'You must agree to the terms and conditions. Set I_agree_with_terms_and_conditions=true.',
          },
        },
        403
      );
    }

    const db = c.env.DB;
    const versionNum = parseInt(version, 10);
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
    }

    if (versionNum === drop.version) {
      return c.json(
        {
          version: drop.version,
          payload: drop.data ?? '',
          iv: drop.iv,
          createdAt: drop.createdAt.toISOString(),
        },
        200
      );
    }

    const historyVersion = await getDropHistoryVersion(db, id, versionNum);
    if (!historyVersion) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Version not found' } }, 404);
    }

    return c.json(
      {
        version: historyVersion.version,
        payload: historyVersion.data ?? '',
        iv: historyVersion.iv,
        createdAt: historyVersion.createdAt.toISOString(),
      },
      200
    );
  });
}
