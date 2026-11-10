// The tracking plan, as types. track() only accepts events listed here, with their exact properties.
// Events go to window.dataLayer (GA4/GTM format). Nothing reaches GA4 unless a GTM container is loaded
// (PUBLIC_GTM_ID); without it, events stay in the page. docs/ANALYTICS.md has the funnel and the reasoning.

export type FailReason = 'validation' | 'email_taken' | 'server' | 'network' | 'timeout';

export type EventMap = {
  landing_viewed: Record<string, never>;
  cta_clicked: { cta_location: 'final_cta' };
  signup_started: Record<string, never>;
  signup_submitted: Record<string, never>;
  // field names only, never what was typed
  signup_failed: { reason: FailReason; fields?: string };
  // GA4's recommended event name; user_id is our opaque uuid, not personal data
  sign_up: { method: 'email'; user_id?: string };
};

type DataLayerEvent = { event: keyof EventMap } & Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const LOOKS_LIKE_EMAIL = /[^\s@]+@[^\s@]+/;
// %40 covers a double-encoded @ that's still encoded after URLSearchParams decodes once
const HAS_AT = /@|%40/i;

// Attribution read once per page load. A UTM that carries an email (it happens with sloppy email campaigns)
// is dropped rather than forwarded.
let context: Record<string, string> | undefined;
function getContext() {
  if (context) return context;
  const params = new URLSearchParams(window.location.search);
  context = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value && !HAS_AT.test(value)) context[key] = value.slice(0, 100);
  }
  return context;
}

export function track<E extends keyof EventMap>(event: E, ...[props]: EventMap[E] extends Record<string, never> ? [] : [EventMap[E]]) {
  const payload: DataLayerEvent = { event, ...getContext(), ...props };
  // last line of defence: an event that somehow carries an email never leaves the page
  if (LOOKS_LIKE_EMAIL.test(JSON.stringify(payload))) {
    console.error(`[analytics] dropped "${event}": payload looked like it contained an email`);
    return;
  }
  (window.dataLayer ??= []).push(payload);
}
