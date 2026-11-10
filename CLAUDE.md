# FX Replay: "Try FX Replay Free" landing

Growth Engineer take-home. Goal: marketing traffic → account creation. Time-boxed to ~6h, so the bar is
"smallest complete, production-minded thing", not feature count. Live: https://fx-replay-growth.vercel.app

## Product and claims

- Audience: retail traders (forex, futures, stocks, indices, crypto) from cold marketing traffic, often mobile.
- Pitch: replay real price history bar by bar and decide with only what you'd have known. The page proves it
  with the Hindsight vs Replay diptych, not with claims.
- **Only verified claims.** The one number allowed: "used by over 1 million traders" (fxreplay.com FAQ,
  checked 2026-11-09), worded as "used by", never customers or active users. No testimonials, logos,
  ratings, results or asset counts (the public site contradicts itself on those). No placeholder proof.
- The hero chart is an illustration with made-up prices and says so on the page. Never present it as data.
- Visual system: `DESIGN.md`. Brand source: the FX Replay Brand Kit (tokens regenerated in `tokens.css`).

@AGENTS.md

## Stack

- Astro 7 (static by default) + one React island for the signup form. Node 24 (`.nvmrc`).
- Vercel adapter. Pages are prerendered; only `src/pages/api/**` runs on demand (`export const prerender = false`).
- Validation: zod from `astro/zod` (no separate zod dependency).
- Persistence: Upstash Redis in deployed envs, in-memory `Map` only in `astro dev` and tests.

## Commands

- `npm run dev` / `astro dev --background`
- `npm run typecheck` (astro check)
- `npm run build`
- `npm test` (Vitest; add `REDIS_TEST_URL` to also hit a real Redis, see README)
- `npm run e2e` (Playwright against local Chrome: signup states, analytics, axe, GTM URL scrub)
- `E2E_BASE_URL=https://fx-replay-growth.vercel.app npx playwright test` (same journeys against a deployment)

## Layout

```
src/pages/index.astro          landing, static
src/pages/api/users/index.ts   GET (admin) / POST (public)
src/pages/api/users/[id].ts    PATCH (admin)
src/components/*.astro         static sections (ReplayDiptych = the hero illustration)
src/components/SignupForm.tsx  the only client island
src/lib/user-schema.ts         zod schema, shared by form and API
src/lib/users-store.ts         create / update / list, nothing else
src/lib/api.ts                 json/error helpers, admin check, body limit
src/lib/analytics.ts           typed events -> window.dataLayer
docs/                          challenge deliverables + JUDGMENT_LOG.md
```

## Rules

- Scope: only what the challenge PDF asks for. Before adding a file, dependency or abstraction, name the
  requirement or quality guarantee it serves. If you can't, don't add it.
- API: create, update, list only. Error envelope is always `{ error: { code, message, fields? } }`.
  GET and PATCH need the admin bearer token; POST is public. Email is immutable via PATCH.
- Never fall back to memory storage outside dev/test. Missing Redis creds in a deployed env = 503, logged.
- Styling: semantic tokens only (`var(--bg-primary)` etc.). No raw hex outside `tokens.css`.
- JS budget: nothing ships to the client except the signup island. No third-party scripts without a doc note.
- Analytics: every event goes through `track()` and must exist in the typed event map. Never put email,
  name or any form value in an event. `sign_up` fires only on the API's 201.
- Accessibility: real labels, visible focus, errors announced via `aria-live`, AA contrast.
- Secrets: never commit tokens or `.env*` (except `.env.example`). Never expose the admin token client side.
- Claims: don't write "works", "passes" or a metric in docs unless a command in this session showed it.

## Human Judgment Log (`docs/JUDGMENT_LOG.md`)

The challenge grades what was delegated to AI vs decided by the human, so this log has to be real.

- Claude may add rows only with status `proposed`, and validation cells only with output of commands it ran.
- `approved` / `implemented` are set only after the human says so explicitly in chat.
- Rejections and corrections are logged when they happen, quoting what was rejected and why.
- Never attribute a decision to the human that they didn't make.

## Workflow

- `/ship-check` (skill) before closing each milestone: typecheck, tests, build, then the `growth-reviewer`
  agent on the diff.
- Playwright MCP (`.mcp.json`) for checking the page at 390 and 1280 (the e2e viewports) and walking the signup flow.
- Docs are written incrementally per milestone and consolidated at the end.
