# Performance review

Measured on the live deployment (https://fx-replay-growth.vercel.app) with Lighthouse 12.8.2, headless Chrome,
2026-11-09. These are lab numbers from one run per profile; field data (RUM) doesn't exist yet.

| Profile | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|
| Mobile (default throttling) | 100 | 100 | 100 | 60 | 1.3 s | 1.7 s | 0 ms | 0 | 1.8 s |
| Desktop | 100 | 100 | 100 | 60 | 0.3 s | 0.3 s | 0 ms | 0 | 0.4 s |

Total transfer is 162 KiB. The LCP element is the `<h1>`, which is text, not an image. SEO 60 comes from one
audit: `is-crawlable`, because the demo is deliberately `noindex` (see SEO below).

## Core Web Vitals

- **LCP:** the h1, rendered in the static HTML. Its font (Lato 900, latin subset) is preloaded, so LCP doesn't
  wait on CSS discovery.
- **CLS: 0.** No images, the SVG has a fixed aspect ratio, and the form is server-rendered at full size before
  hydration. One layout shift was found and fixed in testing: clearing a validation message on blur moved
  the submit button under a tapping finger.
- **INP:** TBT is 0 ms in the lab. The only JS is the form island, and its handlers do little work. Real INP
  needs field data (below).

## Performance decisions

- **Static by default:** the page is prerendered HTML. Only `/api/users*` runs on demand.
- **One island:** `SignupForm` is the only JS. It uses `client:load`, not `client:visible`, because it's
  above the fold and the submit button stays disabled until hydration (that prevents a native submit that
  would drop what people typed).
- **No images:** the hero illustration is SVG computed at build time from an authored price array. The
  wordmark is inlined.
- **Fonts self-hosted:** `@fontsource`, `font-display: swap`, only Lato 400 and 900 plus Nunito Sans variable.
  Non-latin subsets are emitted by the build, but `unicode-range` keeps browsers from downloading them.
- **No third-party scripts by default.** GTM loads only when `PUBLIC_GTM_ID` is set, async.
- **JS budget (production build, gzip):**

| Chunk | Size |
|---|---|
| React client runtime | 65.7 KB |
| Signup island (incl. zod) | 25.9 KB |
| Island loader | 3.0 KB |
| **Total** | **~94 KB** |

## Flagged by Lighthouse, and the call made

- **unused-javascript:** mostly React and zod in the island. Keeping zod shared between client and server was
  a deliberate, human-approved trade-off (one validation contract, can't drift). The next steps, if
  measurements on real traffic justify them:
  - **Preact via `@astrojs/preact` with compat:** cuts most of the ~66 KB React runtime with no change to the
    form code.
  - **`zod/mini`:** shrinks the schema's share of the island.
- **render-blocking CSS:** one small stylesheet. Inlining critical CSS would save a round trip on slow
  connections; not worth the complexity at this size.

## SEO

- **Metadata:** title, description, Open Graph, Twitter card, theme color. `canonical` and `og:url` render
  when `SITE_URL` is set.
- **Semantics:** a single h1, sections labelled by their h2s, an ordered list for the steps, `figure` with
  `figcaption` for each chart panel, and `img` roles with descriptive labels on the SVGs.
- **Structured data:** JSON-LD for `Organization` and `SoftwareApplication`, with **no ratings, reviews or
  offers**, because none of those are verified (inventing them breaks Google's guidelines and our own claims
  rule).
- **Technical, and the `noindex` decision:** the public demo ships `noindex, nofollow`. It uses FX Replay's
  brand on a domain FX Replay doesn't own, so letting search engines index it would put an unofficial page
  in front of people searching for the real product. It stays `noindex` on purpose, and that's the only
  reason production scores SEO 60 (`is-crawlable`).
  - **The indexable configuration is verified:** the same page built with `PUBLIC_INDEXABLE=true` and
    `SITE_URL` emits `index, follow` and a canonical, and scores **SEO 100** in Lighthouse 12.8.2 with no
    failing audits (local production build, served statically).
  - A real launch on an FX Replay domain flips those two env vars.

## Accessibility

- **Automated:** axe (WCAG 2.0/2.1/2.2 A and AA) runs in e2e at 1280 and 390 px with no violations, locally
  and against production. Lighthouse accessibility is 100.
- **Manual fix:** the Brand Kit's border tokens are under 3:1 on the dark ground. Inputs use a page-level
  alias (`--border-input`, about 3.9:1) to meet WCAG 1.4.11; axe doesn't check this. Small accent text uses
  `blue-400` because Electric Blue is only 3.8:1 on black.
- **Form:**
  - Real labels.
  - `aria-invalid` plus `aria-describedby` on errors.
  - Focus moves to the first invalid field, or to the error message.
  - `role="alert"` for form errors, `role="status"` for loading and success.
  - The button keeps focus while submitting (`aria-disabled`, not `disabled`).
  - The honeypot is hidden from assistive tech.
- **Also:** visible focus ring, `prefers-reduced-motion` respected, `color-scheme: dark`, themed text
  selection.
- **Not done:** a manual screen-reader pass with VoiceOver or NVDA.

## Rendering, caching, CDN

- **Rendering:** SSG for the page, Vercel Functions (Node 24) for the API.
- **Hashed assets** under `/_astro/` are immutable, cached at Vercel's edge and in browsers.
- **HTML** is served from the edge cache (`x-vercel-cache` HIT on a repeat request, MISS right after a
  deploy) with `cache-control: public, max-age=0, must-revalidate`, so a deploy shows up immediately.
  Assets were observed as `public, max-age=31536000, immutable`.
- **API** responses are `cache-control: no-store`.

## Production risks

1. **Third-party scripts.** GTM, GA4 and a client-side Convert snippet are the biggest threat to these
   numbers, especially Convert's anti-flicker. Mitigations are in EXPERIMENT.md.
2. **JS growth.** The island is the whole JS budget, so every feature added to the form costs every visitor.
   Set a budget (e.g. 100 KB gzip) and check it in CI.
3. **Lab is not field.** Add Vercel Speed Insights or the `web-vitals` library feeding the data layer, then
   watch p75 LCP, INP and CLS by device class.
4. **Cold starts and the single-region store.** API latency for far-away visitors depends on function cold
   starts and the distance to the Redis region. It doesn't affect page metrics, but it does affect
   time-to-success on submit. Watch POST p95.
5. **Launch checklist:** flipping `noindex`, setting `SITE_URL`, and adding an OG image are easy to forget.
