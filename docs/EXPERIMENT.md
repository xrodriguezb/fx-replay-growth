# Experiment proposal: email-only signup

A proposal, not implemented. Nothing in the code assigns variants today.

## Hypothesis

Asking only for an email will raise signup conversion without hurting what happens after signup. Every
required field adds effort at the moment of highest doubt, and the name isn't needed to create an account
or start a replay. We can ask for it later, in onboarding, when the visitor has already committed.

## Control

The current form: **email + name**, one step, "Create free account".

## Variant

**Email only.** Same page, same copy, the name field removed. The success message drops the name
("You're in." instead of "You're in, Ana.").

Implementation cost is small but not zero, which is part of why it's a good first test:

- `createUserSchema` makes `name` optional (the API keeps accepting it).
- The form hides the field based on the assigned variant.
- `PATCH /api/users/:id` already exists for adding the name later, in onboarding.

## Success metric

**Primary:** signup conversion rate, `sign_up` ÷ `landing_viewed`, unique users, per variant (as defined in
[ANALYTICS.md](ANALYTICS.md)).

**Guardrails.** A breach rejects the variant, even with a conversion lift. The tolerances are fixed before launch (see Decision):

- **Downstream quality:** share of new accounts that start a first replay within 7 days. If email-only
  brings in lower-intent signups, this falls. It needs product data joined by `user_id`.
- **Speed:** LCP p75 per variant. The testing tool must not slow down either arm (see Delivery).
- **API health:** 5xx rate on `POST /api/users` (4xx moves with the variant itself, since it changes validation).
- **Bot share:** honeypot hits per 1,000 submits. A shorter form is easier for bots too.

## Sizing and duration

FX Replay's real baseline isn't public, so here's the method with an assumed number:

- Baseline 10%, minimum detectable effect +10% relative (10% → 11%), power 0.8.
- α = 0.05 two-sided, split across the two prespecified readouts (Bonferroni, so each uses α = 0.025 and
  97.5% intervals). An unadjusted second look can inflate the false-positive rate; the split keeps the
  overall rate at or below 5%.
- That needs **about 17,900 users per arm**: n ≈ (2.24 + 0.84)² × (p₁(1−p₁) + p₂(1−p₂)) / (p₂ − p₁)².
- Run **at least two full weeks** regardless of traffic, so weekday and weekend audiences are both in, and
  fix the end date up front. No stopping early because it looks good on day three.

## Decision

**Fixed before launch, in the pre-registration:**

- **δ (the MDE):** +1 percentage point absolute (10% → 11%). It's both the sizing input above and the
  smallest lift worth shipping, since dropping the name has a cost (less personalisation, one more
  onboarding step).
- **Guardrail tolerances.** These are proposed values; the team confirms them before launch, and they don't
  move afterwards.

| Guardrail | Breach if |
|---|---|
| 7-day first-replay rate | variant is significantly worse: the upper bound of (variant − control) is below 0 |
| LCP p75 | variant − control exceeds +100 ms |
| `POST /api/users` 5xx rate | variant − control exceeds +0.5 pp (an outage hitting both arms is an incident, rule 1) |
| Honeypot hits per 1,000 submits | variant is more than 1.5× control |

The replay guardrail is deliberately "significant harm", not a tight non-inferiority margin. With about
1,800 signups per arm and a replay rate near 50%, the 97.5% interval on the difference is about ±3.8 pp, so
a "lower bound above −1 pp" rule would reject a variant with no effect most of the time. This sample only
catches large harm. Proving no harm smaller than 1 pp would need a much bigger test.

**Analysis points and eligibility (both prespecified):**

- **Readout 1:** enrollment closes at the planned end date (planned sample reached, at least two full
  weeks). Only users assigned before that cutoff are included, and only signups made before the cutoff
  count, for both the primary metric and the replay guardrail. The readout runs 7 days after the cutoff,
  so every included signup has a full 7-day observation window. If traffic is too low to reach the planned
  sample by the planned end date, enrollment continues until it does, up to a maximum date fixed in the
  preregistration. If that date passes first, the test is reported as underpowered and the control stays.
- **Readout 2 (only if rule 4 fires at readout 1):** enrollment reopens until one pre-set extension date.
  The same rules apply: the cutoff is the extension date, and the readout runs 7 days after it.

At each readout, Δ = variant − control in conversion rate, Δ̂ is its point estimate, and [L, U] is its
97.5% interval. The rules below are checked in order and **the first one that matches is the decision**,
so exactly one applies:

1. **Invalid, rerun:** the sample-ratio check fails (χ² p < 0.001 on the 50/50 split) or there was a
   tracking incident. The data can't support any decision.
2. **Reject:** any guardrail is breached, **or** U < δ. Either the variant harms something we protect, or
   the interval rules out a lift worth shipping. That includes a statistically significant but small lift
   (e.g. [+0.2, +0.8] pp): real, but not worth the cost.
3. **Ship:** L > 0 **and** Δ̂ ≥ δ. The lift is statistically significant (above zero) and the estimated
   lift reaches the minimum worthwhile uplift of +1 pp.
4. **Continue:** anything else. That means U ≥ δ, but either L ≤ 0 (zero still plausible) or Δ̂ < δ (a
   real lift whose estimate is below +1 pp). At readout 1, extend **once** (readout 2). At readout 2,
   apply rules 1–3, and if none matches, **reject** (default to the control).

Every interval lands in exactly one case: rule 2 takes all U < δ, rule 3 takes significant lifts estimated
at δ or more, and rule 4 takes the rest. Statistical significance is "L > 0"; practical significance is
"Δ̂ ≥ δ" for shipping and "U < δ" for rejecting. Only the two readouts above count; peeking in between
doesn't trigger any rule.

## Delivery: Convert, flicker and CLS

FX Replay uses Convert (per the job description).

- **Default Convert setup:** a synchronous snippet in `<head>` plus an anti-flicker style that hides the page
  until the variant is applied. That reliably delays FCP/LCP by the script's load time, and when it times
  out, visitors see the control flash into the variant (flicker, and CLS if layout changes).
- **For this page:** removing a field changes the form's height, so a late client-side swap is a CLS risk
  right in the first viewport. Two options, in order of preference:
  1. **Assign at the edge** (Vercel Routing Middleware or Convert's server-side/full-stack SDK). Write the
     variant to a cookie, serve the right static HTML, and the browser never sees a swap. This also keeps
     the page free of render-blocking third-party JS.
  2. If it has to be client-side Convert, **apply the variant inside the React island** (it already owns
     the form), not by DOM-patching static HTML, and reserve the form's height so there's no shift.

## Tracking and validation

- **Exposure event:** `experiment_viewed` with `experiment_id` and `variant`, fired when the form actually
  renders in that variant, not at assignment. The variant also joins every funnel event's context, so all
  of ANALYTICS.md's metrics split by arm.
- **Sticky assignment** per user (cookie), with the variant attached to `sign_up`, so conversion is
  attributed to what the user actually saw.
- **Before launch:**
  - QA both arms with a forced-variant query param.
  - Run an A/A for a few days to confirm the split, tracking and metric pipeline show no difference when
    there is none.
- **During the test:**
  - Daily SRM check.
  - Guardrail dashboards.
  - Reconcile `sign_up` against users created per arm in the store (the source of truth).
