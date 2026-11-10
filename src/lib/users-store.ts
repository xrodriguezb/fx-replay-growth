import { Redis } from '@upstash/redis';
import type { CreateUserInput, UpdateUserInput, User } from './user-schema';

export type CreateResult = { ok: true; user: User } | { ok: false; reason: 'email_taken' };
export type Page = { users: User[]; nextCursor: number | null };

export interface UsersStore {
  create(input: CreateUserInput): Promise<CreateResult>;
  update(id: string, patch: UpdateUserInput): Promise<User | null>;
  list(cursor: number, limit: number): Promise<Page>;
}

export class StoreUnavailableError extends Error {}

// Pages are oldest-first by insertion order. New users only ever append and there's no delete, so offsets
// never shift under a reader.

export function createMemoryStore(): UsersStore {
  const byId = new Map<string, User>();
  const idByEmail = new Map<string, string>();
  const order: string[] = [];

  return {
    async create({ email, name }) {
      // check + write happen in the same tick, so concurrent calls can't both pass
      if (idByEmail.has(email)) return { ok: false, reason: 'email_taken' };
      const now = new Date().toISOString();
      const user: User = { id: crypto.randomUUID(), email, name, createdAt: now, updatedAt: now };
      byId.set(user.id, user);
      idByEmail.set(email, user.id);
      order.push(user.id);
      return { ok: true, user };
    },
    async update(id, patch) {
      const current = byId.get(id);
      if (!current) return null;
      const user = { ...current, ...patch, updatedAt: new Date().toISOString() };
      byId.set(id, user);
      return user;
    },
    async list(cursor, limit) {
      const ids = order.slice(cursor, cursor + limit);
      const next = cursor + ids.length;
      return { users: ids.map((id) => byId.get(id)!), nextCursor: next < order.length ? next : null };
    },
  };
}

// Keys: user:{id} -> user JSON, email:{email} -> id, users (zset, score = users:seq counter).
//
// The user is one JSON string rather than a hash: Upstash's client JSON-parses values on read, so a hash
// field like name "42" would come back as the number 42. A whole JSON document round-trips cleanly.
//
// Create runs as one script so "is the email free?" and the writes can't interleave with another request.
// Redis runs scripts atomically but does NOT roll back: if a command fails after an earlier one wrote, the
// earlier write stays. So the ZADD's precondition (users is a zset) is checked before anything is written,
// INCR goes first because it fails on its own without side effects, and the writes are ordered so the worst
// leftover is the least harmful one (docs/ARCHITECTURE.md, "Consistency").
const CREATE_USER = `
local emailKey, userKey, listKey, seqKey = KEYS[1], KEYS[2], KEYS[3], KEYS[4]
if redis.call('EXISTS', emailKey) == 1 then return 0 end
local listType = redis.call('TYPE', listKey).ok
if listType ~= 'none' and listType ~= 'zset' then return redis.error_reply('users key has wrong type') end
local seq = redis.call('INCR', seqKey)
redis.call('SET', userKey, ARGV[2])
redis.call('SET', emailKey, ARGV[1])
redis.call('ZADD', listKey, seq, ARGV[1])
return 1
`;

export function createRedisStore(redis: Redis): UsersStore {
  const userKey = (id: string) => `user:${id}`;

  return {
    async create({ email, name }) {
      const now = new Date().toISOString();
      const user: User = { id: crypto.randomUUID(), email, name, createdAt: now, updatedAt: now };
      const created = await redis.eval<string[], number>(
        CREATE_USER,
        [`email:${email}`, userKey(user.id), 'users', 'users:seq'],
        [user.id, JSON.stringify(user)],
      );
      return created === 0 ? { ok: false, reason: 'email_taken' } : { ok: true, user };
    },
    async update(id, patch) {
      // no deletes exist, so read-then-write can't resurrect anything; concurrent PATCHes are last-write-wins
      const current = await redis.get<User>(userKey(id));
      if (!current) return null;
      const user = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await redis.set(userKey(id), JSON.stringify(user));
      return user;
    },
    async list(cursor, limit) {
      // ask for one extra to know if there's a next page without a second ZCARD call
      const ids = await redis.zrange<string[]>('users', cursor, cursor + limit);
      const pageIds = ids.slice(0, limit);
      if (pageIds.length === 0) return { users: [], nextCursor: null };
      const users = (await redis.mget<(User | null)[]>(...pageIds.map(userKey))).filter((u): u is User => u !== null);
      return { users, nextCursor: ids.length > limit ? cursor + limit : null };
    },
  };
}

let store: UsersStore | undefined;

// Redis when creds exist. Memory only outside production (dev server, tests). A deployed env without
// creds throws instead of quietly losing every signup on the next cold start.
export function getStore(): UsersStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    store = createRedisStore(new Redis({ url, token }));
  } else if (process.env.NODE_ENV !== 'production') {
    store = createMemoryStore();
  } else {
    throw new StoreUnavailableError('Redis credentials missing in production');
  }
  return store;
}

// tests only
export function setStore(next: UsersStore | undefined) {
  store = next;
}
