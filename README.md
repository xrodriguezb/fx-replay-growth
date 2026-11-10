# Try FX Replay Free

Growth Engineer take-home for FX Replay: a conversion landing page with a signup flow, backed by a small
Users API, instrumented for analytics, built with Claude Code as the main development tool.

- **Live:** https://fx-replay-growth.vercel.app
- **Stack:** Astro 7 (static) + one React island, Vercel Functions, Upstash Redis, zod, Vitest, Playwright

## Deliverables

| Challenge deliverable | Where |
|---|---|
| Working implementation | This repo + the live URL above |
| Architecture overview (incl. infra and "what I'd change for production") | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Analytics plan | [docs/ANALYTICS.md](docs/ANALYTICS.md) |
| Experiment proposal | [docs/EXPERIMENT.md](docs/EXPERIMENT.md) |
| AI-native workflow | [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md), with the evidence log in [docs/JUDGMENT_LOG.md](docs/JUDGMENT_LOG.md) |
| Performance review (CWV, SEO, a11y, caching, risks) | [docs/PERFORMANCE.md](docs/PERFORMANCE.md) |
| Claude Code setup | [CLAUDE.md](CLAUDE.md), [.claude/](.claude/), [.mcp.json](.mcp.json), [DESIGN.md](DESIGN.md) |

## Run locally

Requires Node 24 (`nvm use` reads `.nvmrc`) and, for e2e, Google Chrome installed.

```sh
npm install
npm run dev          # http://localhost:4321
```

No env vars are needed locally. The API uses in-memory storage in dev, so signups reset when the server
restarts. To use the admin endpoints locally, copy `.env.example` to `.env` and set `ADMIN_TOKEN`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run typecheck` | `astro check` |
| `npm test` | Vitest: API handlers + store contract (memory; Redis too if `REDIS_TEST_URL` is set) |
| `npm run e2e` | Playwright in local Chrome, desktop + mobile: signup states, analytics, axe, GTM URL scrub |
| `npm run build` | Production build (Vercel output) |
| `sh .claude/skills/ship-check/check.sh` | All of the above in a fixed order, as one PASS/FAIL report |

## Try the API

```sh
# public: create a user (the signup)
curl -X POST https://fx-replay-growth.vercel.app/api/users \
  -H 'content-type: application/json' -d '{"email":"you@example.com","name":"You"}'

# admin: list and update (needs ADMIN_TOKEN as a bearer token)
curl https://fx-replay-growth.vercel.app/api/users?limit=20 -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X PATCH https://fx-replay-growth.vercel.app/api/users/<id> \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' -d '{"name":"New name"}'
```

The production admin token isn't in this repo. It's shared separately for the review. The full contract,
error codes and consistency guarantees are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#users-api).

### Testing the store against a real Redis

Upstash's client speaks HTTP, so locally it goes through
[serverless-redis-http](https://github.com/hiett/serverless-redis-http):

```sh
docker network create fxr-test
docker run -d --rm --name fxr-redis --network fxr-test redis:7-alpine
docker run -d --rm --name fxr-srh --network fxr-test -p 8079:80 \
  -e SRH_MODE=env -e SRH_TOKEN=local -e SRH_CONNECTION_STRING=redis://fxr-redis:6379 \
  hiett/serverless-redis-http:latest

REDIS_TEST_URL=http://localhost:8079 REDIS_TEST_TOKEN=local npm test
```

### Running e2e against a deployment

```sh
E2E_BASE_URL=https://fx-replay-growth.vercel.app npx playwright test
```

## Environment variables

See [.env.example](.env.example). In production:

- **Set by the Upstash integration:** `KV_REST_API_URL`, `KV_REST_API_TOKEN`.
- **Set manually:** `ADMIN_TOKEN`.
- **Optional:** `PUBLIC_GTM_ID`, `SITE_URL`, `PUBLIC_INDEXABLE`.

## Scope notes

- **Done:** landing, one-step signup with full states, Users API with durable storage, typed analytics,
  production deploy, e2e against production.
- **Proposed only:** the A/B test, as the brief asks.
- **Not done, with reasons in the docs:**
  - Real auth.
  - GA4 delivery (no container connected).
  - Rate limiting.
  - Running CI (no remote repo connected yet).
  - A manual screen-reader pass.
