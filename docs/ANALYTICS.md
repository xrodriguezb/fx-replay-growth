# Analytics plan

**Status:** events are instrumented and verified **in the page** (`window.dataLayer`, Playwright). They are
**not verified as received by GA4**: no GA4 property or GTM container is connected to this demo. Setting
`PUBLIC_GTM_ID` loads GTM, and from there GA4 would pick the events up. That last hop is unverified.

## Events

One typed map in `src/lib/analytics.ts`. `track()` only accepts these names with these properties, so a typo
or an extra field doesn't compile.

| Event | Fires when | Properties |
|---|---|---|
| `landing_viewed` | Signup island hydrates (page usable). Visitors who leave before hydration aren't counted, so this is "hydrated views" (see Funnel) | context |
| `signup_started` | First focus on an input, or the first submit if no input was focused (autofill, Safari button clicks), once per page view | context |
| `signup_submitted` | Client validation passed, request about to go out | context |
| `signup_failed` | Any failure the user sees | `reason`: `validation` / `email_taken` / `server` / `network` / `timeout`; `fields`: comma-separated **field names**, never values |
| `sign_up` | API answered **201** to a submit whose honeypot was empty, so the signup record exists | `method: "email"`, `user_id` (our opaque UUID) |
| `cta_clicked` | Closing CTA clicked | `cta_location: "final_cta"` |

**Context on every event:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` from the
landing URL, read once per page load. Session, client id, device, geo and referrer come from GA4 itself and
aren't duplicated. Experiment variant would be added here once the A/B test runs (see EXPERIMENT.md).

## Funnel

`landing_viewed` → `signup_started` → `signup_submitted` → `sign_up`

- **Primary conversion event:** `sign_up`.
- **Primary metric:** signup conversion rate = unique users with `sign_up` ÷ unique users with
  `landing_viewed`, over the same window. The denominator is hydrated views: someone who bounces before the
  form's JS runs isn't in it, which nudges the rate up slightly. Fine for comparing variants, which share
  the bias. For an absolute rate, use GA4's own `page_view` as the denominator. It's user-scoped rather than session-scoped because the experiment
  randomizes by user, and returning visitors would otherwise inflate the denominator.
- **Diagnostics:** start rate (`signup_started` / `landing_viewed`) measures the pitch; submit → sign_up
  measures form and API health; `signup_failed` by `reason` shows where people get stuck.

## Data quality

- **Typed at the source:** names and properties are checked at compile time.
- **No PII:** emails and names never go in an event. A UTM value containing `@` (or a double-encoded
  `%40`) is dropped from the event context. As a last line of defence, `track()` refuses any payload that
  looks like it contains an email. GA4 also sends the full URL as `page_location`, so when GTM is enabled an
  inline script first removes email-looking query values from the address bar before GTM loads. The
  `gtm` e2e project tests this on a production build with a fake container id. The e2e suite asserts there's no `@` anywhere in the data layer across
  the success and failure flows.
- **The conversion is server-confirmed:** `sign_up` fires on the API's 201, not on the button click.
  Validation errors, 409s and network failures can't count as conversions.
- **Counted once:** `sign_up` has exactly one call site, the 201 branch, and a request can't be sent twice
  because the form ignores submits while one is in flight. The success view has no URL, so a refresh can't
  re-fire it. The e2e suite asserts exactly one `sign_up` per signup, including when Enter is pressed again
  mid-request.
- **Order is tested:** e2e asserts the exact sequence above.
- **Reconciliation (production):** the Users store is the source of truth. Daily `sign_up` count in GA4 vs
  users created that day: a gap beyond a set threshold means tracking loss (ad blockers, consent, script
  errors) or bot noise, and triggers a look. Expect GA4 to under-count; the gap should be stable, not zero.
  One known source: a request that times out on the client but succeeds on the server shows up as
  `signup_failed: timeout`, then `email_taken` on retry, with no `sign_up`. The server-side event below
  closes that gap.
- **Bots:** the honeypot keeps obvious bots out of the store. The server answers a filled honeypot with a
  fake 201 (so bots don't adapt), and the form, which knows its own honeypot was filled, does **not** fire
  `sign_up` for it. There's an e2e test for this. Honeypot hits show up only as a server log line, never as
  conversions. A browser bot that fills the honeypot still sends `signup_submitted`, so it shows up as a
  submit → `sign_up` drop-off (compare with the honeypot log count when that rate moves). GA4's known-bot
  filter plus an internal-traffic filter keep bots out of the denominator.

## Architecture

`track()` → `window.dataLayer` → GTM (only if `PUBLIC_GTM_ID`) → GA4 tag.

- GTM and GA4 because that's what FX Replay's marketing stack uses (per the job description), and it lets
  marketing change tags without deploys.
- `dataLayer` is the only contract the code knows about, so switching to Segment/PostHog later means changing
  `track()` and nothing else.

**What I'd add for production**
- Consent Mode v2 defaults before GTM loads.
- A server-side `sign_up` via the GA4 Measurement Protocol from the API on 201, deduplicated against the
  client event by `user_id`. Ad blockers can't drop that one.
