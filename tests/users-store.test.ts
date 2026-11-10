import { Redis } from '@upstash/redis';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStore, createRedisStore, type UsersStore } from '../src/lib/users-store';

// Same contract against both stores. The Redis half needs a real Redis behind an Upstash-compatible
// REST endpoint (see README, "Testing against Redis"); without REDIS_TEST_URL it's skipped, not faked.
const redisUrl = process.env.REDIS_TEST_URL;
const redis = redisUrl ? new Redis({ url: redisUrl, token: process.env.REDIS_TEST_TOKEN ?? 'local' }) : null;

const stores: [string, () => Promise<UsersStore>, boolean][] = [
  ['memory', async () => createMemoryStore(), true],
  [
    'redis',
    async () => {
      await redis!.flushdb();
      return createRedisStore(redis!);
    },
    redis !== null,
  ],
];

describe.each(stores)('%s store', (_name, make, enabled) => {
  let store: UsersStore;
  beforeEach(async () => {
    if (enabled) store = await make();
  });

  it.runIf(enabled)('persists and lists in insertion order', async () => {
    const a = await store.create({ email: 'a@example.com', name: 'A' });
    const b = await store.create({ email: 'b@example.com', name: 'B' });
    expect(a.ok && b.ok).toBe(true);
    const page = await store.list(0, 10);
    expect(page.users.map((u) => u.email)).toEqual(['a@example.com', 'b@example.com']);
    expect(page.nextCursor).toBeNull();
  });

  it.runIf(enabled)('does not skip or repeat users created between page requests', async () => {
    for (const n of ['a', 'b', 'c']) await store.create({ email: `${n}@example.com`, name: n });

    const first = await store.list(0, 2);
    await store.create({ email: 'd@example.com', name: 'd' });
    const second = await store.list(first.nextCursor!, 2);

    const seen = [first, second].flatMap((p) => p.users.map((u) => u.name));
    expect(seen).toEqual(['a', 'b', 'c', 'd']);
    expect(second.nextCursor).toBeNull();

    // null means "nothing more right now"; later arrivals show up after the last offset read
    await store.create({ email: 'e@example.com', name: 'e' });
    expect((await store.list(4, 2)).users.map((u) => u.name)).toEqual(['e']);
  });

  it.runIf(enabled)('returns names that look like JSON as plain strings', async () => {
    for (const name of ['42', 'null', 'true', '"quoted"']) {
      await store.create({ email: `${encodeURIComponent(name)}@example.com`, name });
    }
    const names = (await store.list(0, 10)).users.map((u) => u.name);
    expect(names).toEqual(['42', 'null', 'true', '"quoted"']);
  });

  it.runIf(enabled)('allows one winner among concurrent creates with the same email', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => store.create({ email: 'race@example.com', name: `n${i}` })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await store.list(0, 100)).users).toHaveLength(1);
  });

  it.runIf(enabled)('updates the name and keeps the rest', async () => {
    const created = await store.create({ email: 'u@example.com', name: 'Old' });
    if (!created.ok) throw new Error('setup failed');
    const updated = await store.update(created.user.id, { name: 'New' });
    expect(updated).toMatchObject({ id: created.user.id, email: 'u@example.com', name: 'New' });
    expect((await store.list(0, 10)).users[0].name).toBe('New');
    expect(await store.update(crypto.randomUUID(), { name: 'X' })).toBeNull();
  });
});

describe.runIf(redis !== null)('redis create script', () => {
  it('writes nothing when a key has the wrong type', async () => {
    await redis!.flushdb();
    await redis!.set('users', 'not-a-zset');
    const store = createRedisStore(redis!);

    await expect(store.create({ email: 'x@example.com', name: 'X' })).rejects.toThrow(/wrong type/);
    expect(await redis!.exists('email:x@example.com')).toBe(0);
    expect(await redis!.keys('user:*')).toEqual([]);
    expect(await redis!.exists('users:seq')).toBe(0);
  });
});
