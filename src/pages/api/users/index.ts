import type { APIRoute } from 'astro';
import { apiError, isAdmin, json, readJson, storeFailure, unauthorized } from '../../../lib/api';
import { createUserSchema, fieldErrors, listQuerySchema } from '../../../lib/user-schema';
import { getStore } from '../../../lib/users-store';

export const prerender = false;

// public: this is the signup
export const POST: APIRoute = async ({ request }) => {
  const read = await readJson(request);
  if ('response' in read) return read.response;

  const parsed = createUserSchema.safeParse(read.body);
  if (!parsed.success) {
    return apiError(400, 'VALIDATION', 'Please fix the highlighted fields', fieldErrors(parsed.error));
  }

  // honeypot: only bots fill the hidden field. Answer like a success so they don't adapt, store nothing,
  // and leave a PII-free log line so a spike (or autofill catching real people) is visible
  const trap = (read.body as { fxr_hp?: unknown } | null)?.fxr_hp;
  if (typeof trap === 'string' && trap.trim() !== '') {
    console.warn('[users-api] honeypot triggered');
    const now = new Date().toISOString();
    return json({ user: { id: crypto.randomUUID(), ...parsed.data, createdAt: now, updatedAt: now } }, 201);
  }

  try {
    const result = await getStore().create(parsed.data);
    if (!result.ok) {
      return apiError(409, 'EMAIL_TAKEN', 'This email has already signed up', {
        email: 'This email has already signed up',
      });
    }
    return json({ user: result.user }, 201);
  } catch (err) {
    return storeFailure(err);
  }
};

// admin: the list has PII
export const GET: APIRoute = async ({ request, url }) => {
  if (!isAdmin(request)) return unauthorized();

  const query = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return apiError(400, 'VALIDATION', 'Invalid query parameters', fieldErrors(query.error));
  }

  try {
    return json(await getStore().list(query.data.cursor, query.data.limit));
  } catch (err) {
    return storeFailure(err);
  }
};
