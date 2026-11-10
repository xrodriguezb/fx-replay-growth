# Analytics plan

**Status:** the app pushes typed events to `window.dataLayer`, verified in the page with Playwright. Nothing
forwards them automatically. In GTM (loaded via `PUBLIC_GTM_ID`) that takes a Google tag with the GA4
Measurement ID, which sends `page_view` (carrying `page_location`) and is where User-ID is set explicitly from
`user_id`; plus Custom Event triggers and GA4 Event tags for the six events, with Data Layer Variables for
their parameters. In GA4, marking `sign_up` as a key event makes it a conversion, and registering `reason`,
`fields`, `cta_location` and `method` as custom dimensions makes them reportable. The UTMs aren't registered
as custom dimensions: GA4's standard campaign attribution reads them from `page_location`. No GTM container
or GA4 property is connected to this demo, so delivery and reporting are **not verified**.

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
landing URL, read once per page load. Only values that look like campaign slugs (letters, digits, `.`,
`_`, `-`, up to 100 characters) are kept. That's the convention campaign links should follow anyway, and
it drops spaces, `@` and free text. Session, client id, device, geo and referrer come from GA4 itself and
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
- **Privacy: what's guaranteed, and what isn't.**
  - **Guaranteed by construction:** form values (email, name) never go in an event. Events only carry
    enum codes, field names, our UUID and filtered UTMs.
  - **Filtered by format:**
    - UTM values that aren't campaign slugs are dropped (an email, `Ana%20Lopez`).
    - `track()` refuses any payload that still looks like it contains an email.
    - GA4 sends the full URL as `page_location`, so when GTM is enabled an inline script first removes
      these from the address bar before GTM loads: known contact parameters (`email`, `phone`, `tel`,
      `mobile`, `name`, `first_name`, `last_name`, `full_name`), any value containing `@`/`%40`, and non-slug
      UTM values.
  - **Not guaranteed:** this is a filter for known shapes, not PII detection. A name written as a slug
    (`utm_term=ana-lopez`) or personal data under an unlisted parameter name would still pass. The real
    control is a campaign-naming convention for marketing links, plus GA4's own data-redaction settings
    once a property exists.
  - **Tests:** e2e asserts no `@` in the data layer across the success and failure flows and drops a
    non-slug UTM. The `gtm` project checks the URL scrub on a production build with a fake container id,
    using emails (plain and double-encoded), a phone, a first name and a spaced name.
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

`track()` → `window.dataLayer` → GTM (only if `PUBLIC_GTM_ID`; needs a Google tag and GA4 Event tags) → GA4.

- GTM and GA4 because that's what FX Replay's marketing stack uses (per the job description), and it lets
  marketing change tags without deploys.
- `dataLayer` is the only contract the code knows about, so switching to Segment/PostHog later means changing
  `track()` and nothing else.

**What I'd add for production**
- Consent Mode v2 defaults before GTM loads.
- A server-side `sign_up` via the GA4 Measurement Protocol from the API on 201, deduplicated against the
  client event by `user_id`. Ad blockers can't drop that one.
