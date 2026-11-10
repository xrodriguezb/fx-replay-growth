import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { apiError, isAdmin, json, readJson, storeFailure, unauthorized } from '../../../lib/api';
import { fieldErrors, updateUserSchema } from '../../../lib/user-schema';
import { getStore } from '../../../lib/users-store';

export const prerender = false;

// admin only: there are no user sessions, so a public PATCH would let anyone edit anyone
export const PATCH: APIRoute = async ({ request, params }) => {
  if (!isAdmin(request)) return unauthorized();

  // ids are uuids, anything else can't exist, skip the store round trip
  if (!z.uuid().safeParse(params.id).success) {
    return apiError(404, 'NOT_FOUND', 'User not found');
  }

  const read = await readJson(request);
  if ('response' in read) return read.response;

  const parsed = updateUserSchema.safeParse(read.body);
  if (!parsed.success) {
    return apiError(400, 'VALIDATION', 'Please fix the highlighted fields', fieldErrors(parsed.error));
  }

  try {
    const user = await getStore().update(params.id!, parsed.data);
    if (!user) return apiError(404, 'NOT_FOUND', 'User not found');
    return json({ user });
  } catch (err) {
    return storeFailure(err);
  }
};
