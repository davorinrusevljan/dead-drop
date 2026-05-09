import { Hono } from 'hono';
import { authMiddleware } from '../middleware.js';
import { requireRole } from '../middleware.js';
import type { AppEnv } from '../index.js';
import {
  createBackupRecord,
  updateBackupRecord,
  getBackupRecord,
  listBackupRecords,
  isBackupRunning,
} from '../db-backup.js';
import {
  buildR2Key,
  buildExportUrl,
  buildCfApiHeaders,
  buildExportRequestBody,
  buildPollRequestBody,
  parseExportResponse,
  type CloudflareApiResponse,
} from '../backup-logic.js';

const backupRoutes = new Hono<AppEnv>();

// All backup routes require superadmin
backupRoutes.use('*', authMiddleware);
backupRoutes.use('*', requireRole('superadmin'));

/**
 * POST /start - Initiate a full database backup
 */
backupRoutes.post('/start', async (c) => {
  const adminDb = c.env.ADMIN_DB;
  const user = c.get('user');
  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401);
  }

  // Check if backup already running
  const running = await isBackupRunning(adminDb);
  if (running) {
    return c.json(
      { error: { code: 'BACKUP_IN_PROGRESS', message: 'A backup is already in progress' } },
      409
    );
  }

  // Validate CF API credentials
  if (!c.env.CLOUDFLARE_API_TOKEN || !c.env.CLOUDFLARE_ACCOUNT_ID || !c.env.CLOUDFLARE_CORE_DB_ID) {
    return c.json(
      {
        error: {
          code: 'BACKUP_NOT_CONFIGURED',
          message: 'Cloudflare API credentials not configured',
        },
      },
      503
    );
  }

  // Create backup record
  const record = await createBackupRecord(adminDb, {
    triggeredBy: user.id,
  });

  try {
    // Update to running
    await updateBackupRecord(adminDb, record.id, { status: 'running' });

    // Initiate D1 export via CF API
    // Export core database (the one with drop data)
    const exportUrl = buildExportUrl(c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_CORE_DB_ID);
    const headers = buildCfApiHeaders(c.env.CLOUDFLARE_API_TOKEN);
    const body = buildExportRequestBody();

    const response = await fetch(exportUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = (await response.text()) as string;
      await updateBackupRecord(adminDb, record.id, {
        status: 'failed',
        errorMessage: `CF API returned ${response.status}: ${errorBody}`,
        completedAt: new Date(),
      });
      return c.json(
        {
          error: {
            code: 'BACKUP_START_FAILED',
            message: 'Failed to start database export',
          },
        },
        502
      );
    }

    const resultBody = (await response.json()) as CloudflareApiResponse;
    const parsed = parseExportResponse(resultBody);

    if (parsed.status === 'complete' && parsed.signedUrl) {
      // Export completed immediately (small DB) — download and store
      const r2Key = buildR2Key();
      const downloadResult = await downloadAndStore(parsed.signedUrl, c.env.BACKUP_BUCKET, r2Key);

      if (downloadResult.success) {
        await updateBackupRecord(adminDb, record.id, {
          status: 'complete',
          r2Key,
          r2SizeBytes: downloadResult.sizeBytes,
          completedAt: new Date(),
        });
        return c.json({
          id: record.id,
          status: 'complete',
          r2Key,
          sizeBytes: downloadResult.sizeBytes,
        });
      } else {
        await updateBackupRecord(adminDb, record.id, {
          status: 'failed',
          errorMessage: downloadResult.error ?? 'Failed to download/upload backup',
          completedAt: new Date(),
        });
        return c.json(
          {
            error: {
              code: 'BACKUP_STORE_FAILED',
              message: downloadResult.error ?? 'Failed to store backup in R2',
            },
          },
          502
        );
      }
    }

    // Export in progress — save bookmark for polling
    await updateBackupRecord(adminDb, record.id, {
      cfBookmark: parsed.bookmark,
    });

    return c.json({
      id: record.id,
      status: 'running',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await updateBackupRecord(adminDb, record.id, {
      status: 'failed',
      errorMessage: message,
      completedAt: new Date(),
    });
    return c.json({ error: { code: 'BACKUP_ERROR', message } }, 500);
  }
});

/**
 * GET / - List backup history
 */
backupRoutes.get('/', async (c) => {
  const adminDb = c.env.ADMIN_DB;
  const records = await listBackupRecords(adminDb);
  return c.json({
    backups: records.map((r) => ({
      id: r.id,
      status: r.status,
      r2Key: r.r2Key,
      sizeBytes: r.r2SizeBytes,
      errorMessage: r.errorMessage,
      startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
      completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
    })),
  });
});

/**
 * GET /{id} - Get backup status / continue polling
 */
backupRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const adminDb = c.env.ADMIN_DB;

  const record = await getBackupRecord(adminDb, id);
  if (!record) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Backup record not found' } }, 404);
  }

  // If backup is in running state and has a bookmark, poll CF API
  if (record.status === 'running' && record.cfBookmark) {
    try {
      const exportUrl = buildExportUrl(c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_CORE_DB_ID);
      const headers = buildCfApiHeaders(c.env.CLOUDFLARE_API_TOKEN);
      const body = buildPollRequestBody(record.cfBookmark);

      const response = await fetch(exportUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // Polling failed — but don't mark backup as failed yet (might be transient)
        return c.json({
          id: record.id,
          status: 'running',
          message: 'Poll request failed, retry later',
        });
      }

      const resultBody = (await response.json()) as CloudflareApiResponse;
      const parsed = parseExportResponse(resultBody);

      if (parsed.status === 'complete' && parsed.signedUrl) {
        // Download and store
        const r2Key = buildR2Key();
        const downloadResult = await downloadAndStore(parsed.signedUrl, c.env.BACKUP_BUCKET, r2Key);

        if (downloadResult.success) {
          await updateBackupRecord(adminDb, record.id, {
            status: 'complete',
            r2Key,
            r2SizeBytes: downloadResult.sizeBytes,
            cfBookmark: null,
            completedAt: new Date(),
          });

          return c.json({
            id: record.id,
            status: 'complete',
            r2Key,
            sizeBytes: downloadResult.sizeBytes,
          });
        } else {
          await updateBackupRecord(adminDb, record.id, {
            status: 'failed',
            errorMessage: downloadResult.error ?? 'Failed to download/upload backup',
            completedAt: new Date(),
          });
          return c.json(
            {
              error: {
                code: 'BACKUP_STORE_FAILED',
                message: downloadResult.error,
              },
            },
            502
          );
        }
      }

      // Still running — update bookmark
      if (parsed.bookmark) {
        await updateBackupRecord(adminDb, record.id, {
          cfBookmark: parsed.bookmark,
        });
      }

      return c.json({
        id: record.id,
        status: 'running',
      });
    } catch (err) {
      // Don't fail the backup on poll error — just return current status
      return c.json({
        id: record.id,
        status: 'running',
      });
    }
  }

  // Return current status
  return c.json({
    id: record.id,
    status: record.status,
    r2Key: record.r2Key,
    sizeBytes: record.r2SizeBytes,
    errorMessage: record.errorMessage,
    startedAt: record.startedAt instanceof Date ? record.startedAt.toISOString() : record.startedAt,
    completedAt:
      record.completedAt instanceof Date ? record.completedAt.toISOString() : record.completedAt,
  });
});

/**
 * Download SQL from signed URL and store in R2
 */
async function downloadAndStore(
  signedUrl: string,
  bucket: R2Bucket,
  r2Key: string
): Promise<{ success: boolean; sizeBytes?: number; error?: string }> {
  try {
    const response = await fetch(signedUrl);
    if (!response.ok) {
      return {
        success: false,
        error: `Download failed with status ${response.status}`,
      };
    }

    const sqlData = await response.arrayBuffer();
    const sizeBytes = sqlData.byteLength;

    await bucket.put(r2Key, sqlData, {
      httpMetadata: {
        contentType: 'application/sql',
      },
      customMetadata: {
        backupDate: new Date().toISOString(),
      },
    });

    return { success: true, sizeBytes };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown download/upload error',
    };
  }
}

export { backupRoutes };
