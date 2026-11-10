import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../src/pages/api/users/index';
import { PATCH } from '../src/pages/api/users/[id]';
import { createMemoryStore, setStore } from '../src/lib/users-store';

const TOKEN = 'test-admin-token';
const BASE = 'http://localhost/api/users';

// the handlers only read request/url/params, so a thin fake context is enough
const ctx = (request: Request, params: Record<string, string> = {}) =>
  ({ request, url: new URL(request.url), params }) as any;

const post = (body: unknown) =>
  POST(ctx(new Request(BASE, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })));

const get = (query = '', token: string | null = TOKEN) =>
  GET(ctx(new Request(`${BASE}${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })));

const patch = (id: string, body: unknown, token: string | null = TOKEN) =>
  PATCH(
    ctx(
      new Request(`${BASE}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
      { id },
    ),
  );

beforeEach(() => {
  setStore(createMemoryStore());
  vi.stubEnv('ADMIN_TOKEN', TOKEN);
});

afterEach(() => {
  setStore(undefined);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/users', () => {
  it('creates a user and normalizes the email', async () => {
    const res = await post({ email: '  Trader@Example.COM ', name: ' Ana ' });
    expect(res.status).toBe(201);
    const { user } = await res.json();
    expect(user).toMatchObject({ email: 'trader@example.com', name: 'Ana' });
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns field errors for invalid input', async () => {
    const res = await post({ email: 'not-an-email', name: '' });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION');
    expect(Object.keys(error.fields).sort()).toEqual(['email', 'name']);
  });

  it('rejects malformed and oversized bodies', async () => {
    expect((await post('{nope')).status).toBe(400);
    expect((await post({ email: 'a@b.co', name: 'x'.repeat(5000) })).status).toBe(413);
  });

  it('returns 409 for a duplicate email regardless of case', async () => {
    await post({ email: 'dup@example.com', name: 'One' });
    const res = await post({ email: 'DUP@example.com', name: 'Two' });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('EMAIL_TAKEN');
  });

  it('lets exactly one of many concurrent signups with the same email win', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => post({ email: 'race@example.com', name: `n${i}` })),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
  });

  it('turns a store failure into a 503 without logging the email', async () => {
    const store = createMemoryStore();
    store.create = () => Promise.reject(new Error('ECONNRESET'));
    setStore(store);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await post({ email: 'secret@example.com', name: 'Ana' });

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('STORE_UNAVAILABLE');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret@example.com');
  });

  it('answers the honeypot like a success but stores nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await post({ email: 'bot@example.com', name: 'Bot', fxr_hp: 'http://spam.example' });
    expect(res.status).toBe(201);
    expect((await (await get()).json()).users).toEqual([]);
  });

  it('refuses to fall back to memory in production without Redis creds', async () => {
    setStore(undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await post({ email: 'a@example.com', name: 'Ana' });
    expect(res.status).toBe(503);
  });
});

describe('GET /api/users', () => {
  it('requires the admin token, and fails closed when none is configured', async () => {
    expect((await get('', null)).status).toBe(401);
    expect((await get('', 'wrong')).status).toBe(401);
    vi.stubEnv('ADMIN_TOKEN', '');
    expect((await get('', TOKEN)).status).toBe(401);
  });

  it('paginates oldest first with a cursor', async () => {
    for (const n of ['a', 'b', 'c']) await post({ email: `${n}@example.com`, name: n });

    const first = await (await get('?limit=2')).json();
    expect(first.users.map((u: { name: string }) => u.name)).toEqual(['a', 'b']);
    expect(first.nextCursor).toBe(2);

    const second = await (await get(`?limit=2&cursor=${first.nextCursor}`)).json();
    expect(second.users.map((u: { name: string }) => u.name)).toEqual(['c']);
    expect(second.nextCursor).toBeNull();
  });

  it('rejects out-of-range limit and cursor', async () => {
    expect((await get('?limit=1000')).status).toBe(400);
    expect((await get('?cursor=1e20')).status).toBe(400);
  });
});

describe('PATCH /api/users/:id', () => {
  const createUser = async () => (await (await post({ email: 'p@example.com', name: 'Old' })).json()).user;

  it('updates the name', async () => {
    const user = await createUser();
    const res = await patch(user.id, { name: 'New' });
    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ id: user.id, email: 'p@example.com', name: 'New' });
  });

  it('requires the admin token', async () => {
    const user = await createUser();
    expect((await patch(user.id, { name: 'New' }, null)).status).toBe(401);
  });

  it('refuses to change the email or accept unknown fields', async () => {
    const user = await createUser();
    const res = await patch(user.id, { name: 'New', email: 'other@example.com' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown and malformed ids', async () => {
    expect((await patch(crypto.randomUUID(), { name: 'X' })).status).toBe(404);
    expect((await patch('not-a-uuid', { name: 'X' })).status).toBe(404);
  });
});
