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

**Guardrails.** The test fails if any of these get worse, even with a conversion lift:

- **Downstream quality:** share of new accounts that start a first replay within 7 days. If email-only
  brings in lower-intent signups, this falls. It needs product data joined by `user_id`.
- **Speed:** LCP p75 per variant. The testing tool must not slow down either arm (see Delivery).
- **API health:** 4xx/5xx rate on `POST /api/users`.
- **Bot share:** honeypot hits per 1,000 signups. A shorter form is easier for bots too.

## Sizing and duration

FX Replay's real baseline isn't public, so here's the method with an assumed number:

- Baseline 10%, minimum detectable effect +10% relative (10% → 11%), α = 0.05 two-sided, power 0.8.
- That needs **about 14,700 users per arm**: n ≈ (1.96 + 0.84)² × (p₁(1−p₁) + p₂(1−p₂)) / (p₂ − p₁)².
- Run **at least two full weeks** regardless of traffic, so weekday and weekend audiences are both in, and
  fix the end date up front. No stopping early because it looks good on day three.

## Decision

At the planned end date:

- **Ship the variant** if the primary metric lifts with the 95% interval above zero, no guardrail
  regresses beyond its threshold, and the sample-ratio check passes.
- **Continue** if the planned sample isn't reached, or the interval still includes both zero and the MDE.
  Extend once to a new fixed date; don't peek in a loop.
- **Reject the variant** if the interval's upper bound is below the MDE (a real win, if any, is too small to
  matter), or any guardrail regresses, even if conversion went up.
- **Invalidate and rerun** on a sample-ratio mismatch (χ² p < 0.001 on the 50/50 split). It means
  assignment or tracking is broken, and the result can't be trusted in either direction.

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
