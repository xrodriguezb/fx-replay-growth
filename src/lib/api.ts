import { createHash, timingSafeEqual } from 'node:crypto';
import { StoreUnavailableError } from './users-store';

export type ErrorCode =
  | 'VALIDATION'
  | 'INVALID_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'STORE_UNAVAILABLE';

const MAX_BODY_BYTES = 4 * 1024;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export function apiError(status: number, code: ErrorCode, message: string, fields?: Record<string, string>) {
  return json({ error: { code, message, ...(fields && { fields }) } }, status);
}

// returns the parsed body, or a ready-to-send error response
export async function readJson(request: Request): Promise<{ body: unknown } | { response: Response }> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { response: apiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large') };
  }
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { response: apiError(400, 'INVALID_JSON', 'Request body must be valid JSON') };
  }
}

// Fails closed: no ADMIN_TOKEN configured means nobody gets in.
// Both sides are hashed first so timingSafeEqual always compares equal-length buffers.
export function isAdmin(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const header = request.headers.get('authorization') ?? '';
  if (!expected || !header.startsWith('Bearer ')) return false;
  // Uint8Array wrap keeps TS 6 happy, Buffer's typing clashes with ArrayBufferView
  const digest = (s: string) => new Uint8Array(createHash('sha256').update(s).digest());
  return timingSafeEqual(digest(header.slice(7)), digest(expected));
}

export const unauthorized = () => apiError(401, 'UNAUTHORIZED', 'Missing or invalid admin token');

// Store failures become a 503 the client can retry. The log line has the error, never the payload,
// so no emails end up in function logs.
export function storeFailure(err: unknown): Response {
  const reason = err instanceof StoreUnavailableError ? err.message : 'store call failed';
  console.error('[users-api] STORE_UNAVAILABLE:', reason, err instanceof Error ? err.name : typeof err);
  return apiError(503, 'STORE_UNAVAILABLE', 'We could not save your details. Please try again.');
}
