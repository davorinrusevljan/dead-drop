/**
 * Backup logic for D1 database export via Cloudflare API
 *
 * Flow:
 * 1. Call CF D1 export API to start export → get bookmark
 * 2. Poll until export complete → get signed_url
 * 3. Download SQL dump from signed_url
 * 4. Upload to R2
 */

/**
 * Build R2 key for a backup file
 * Format: backups/{YYYY-MM-DD_HH-mm-ss}_full.sql
 */
export function buildR2Key(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
  return `backups/${timestamp}_full.sql`;
}

/**
 * Build the CF D1 export API URL
 */
export function buildExportUrl(accountId: string, databaseId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/export`;
}

/**
 * Build request headers for CF API
 */
export function buildCfApiHeaders(apiToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiToken}`,
  };
}

/**
 * Build request body for initiating an export
 */
export function buildExportRequestBody(): Record<string, unknown> {
  return {
    output_format: 'polling',
    dump_options: {
      no_data: false,
      no_schema: false,
    },
  };
}

/**
 * Build request body for polling an in-progress export
 */
export function buildPollRequestBody(bookmark: string): Record<string, unknown> {
  return {
    output_format: 'polling',
    current_bookmark: bookmark,
  };
}

/**
 * Parse the CF API response for export initiation
 */
export function parseExportResponse(body: CloudflareApiResponse): ExportResponseResult {
  if (!body.success) {
    const errors = body.errors?.map((e) => e.message).join('; ') ?? 'Unknown error';
    throw new Error(`CF API error: ${errors}`);
  }

  const result = body.result;
  if (!result) {
    throw new Error('CF API error: no result in response');
  }

  return {
    status: result.status ?? 'error',
    bookmark: result.at_bookmark ?? null,
    signedUrl: result.result?.signed_url ?? null,
    filename: result.result?.filename ?? null,
    error: result.error ?? null,
    messages: result.messages ?? [],
  };
}

/**
 * Export response result (parsed)
 */
export interface ExportResponseResult {
  status: 'complete' | 'error' | string;
  bookmark: string | null;
  signedUrl: string | null;
  filename: string | null;
  error: string | null;
  messages: string[];
}

/**
 * CF API response shape
 */
export interface CloudflareApiError {
  code: number;
  message: string;
  documentation_url?: string;
}

export interface CloudflareApiResult {
  at_bookmark?: string;
  error?: string;
  messages?: string[];
  result?: {
    filename?: string;
    signed_url?: string;
  };
  status?: string;
  success?: boolean;
  type?: string;
}

export interface CloudflareApiResponse {
  success: boolean;
  errors?: CloudflareApiError[];
  messages?: unknown[];
  result?: CloudflareApiResult;
}
