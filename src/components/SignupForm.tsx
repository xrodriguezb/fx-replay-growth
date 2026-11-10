import { useEffect, useRef, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { track, type FailReason } from '../lib/analytics';
import { createUserSchema, fieldErrors, type CreateUserInput } from '../lib/user-schema';

type FieldErrors = Partial<Record<keyof CreateUserInput, string>>;

// one union so "loading and showing an error at the same time" can't happen
type State =
  | { status: 'idle'; errors: FieldErrors; formError?: string }
  | { status: 'submitting' }
  | { status: 'success'; user: CreateUserInput };

const TIMEOUT_MS = 10_000;
const GENERIC_ERROR = 'Something went wrong on our side. Your details are still here, please try again.';
// non-semantic name so password managers and autofill leave it alone; only bots fill it
const TRAP_FIELD = 'fxr_hp';

export default function SignupForm() {
  const [state, setState] = useState<State>({ status: 'idle', errors: {} });
  // the SSR'd form can't submit until React owns it, otherwise a native submit would lose what was typed
  const [hydrated, setHydrated] = useState(false);
  const successRef = useRef<HTMLHeadingElement>(null);
  // where focus goes after a submit settles
  const focusNext = useRef<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    setHydrated(true);
    track('landing_viewed');
    // this island is the page's only JS, so it also reports clicks on the static CTA links
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest('[data-track-cta="final_cta"]')) track('cta_clicked', { cta_location: 'final_cta' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (state.status === 'success') successRef.current?.focus();
    if (state.status === 'idle' && focusNext.current) {
      document.getElementById(focusNext.current)?.focus();
      focusNext.current = null;
    }
  }, [state]);

  const errors = state.status === 'idle' ? state.errors : {};
  const submitting = state.status === 'submitting';

  // first real interaction with the form: typing/focusing a field, or submitting (autofill + Safari clicks
  // don't focus anything, and pre-hydration typing never reaches React)
  function markStarted() {
    if (started.current) return;
    started.current = true;
    track('signup_started');
  }

  function settle(errors: FieldErrors, reason: FailReason, formError?: string) {
    const fields = Object.keys(errors).filter((k) => errors[k as keyof FieldErrors]);
    track('signup_failed', fields.length ? { reason, fields: fields.join(',') } : { reason });
    focusNext.current = formError ? 'signup-form-error' : errors.email ? 'signup-email' : 'signup-name';
    setState({ status: 'idle', errors, formError });
  }

  // A field that already shows an error re-checks as people type, so the message clears as soon as it's fixed.
  // Not on blur: clearing on blur shifts the layout under a finger that's already tapping the submit button.
  function revalidate(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as keyof CreateUserInput;
    if (state.status !== 'idle' || !state.errors[name]) return;
    const parsed = createUserSchema.shape[name].safeParse(event.target.value);
    setState({ ...state, errors: { ...state.errors, [name]: parsed.success ? undefined : parsed.error.issues[0].message } });
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === 'submitting') return;
    markStarted();

    // read the DOM, not React state, so anything typed before hydration still counts
    const form = new FormData(event.currentTarget);
    const parsed = createUserSchema.safeParse({ email: form.get('email'), name: form.get('name') });
    if (!parsed.success) return settle(fieldErrors(parsed.error), 'validation');

    track('signup_submitted');
    setState({ status: 'submitting' });

    // The server answers a filled honeypot with a fake 201 and stores nothing, so the form must not count it.
    // Same rule as the server (non-empty after trim), decided from what this form sent, not from the response.
    const trap = String(form.get(TRAP_FIELD) ?? '');
    const trapped = trap.trim() !== '';

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...parsed.data, [TRAP_FIELD]: trap }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = await res.json().catch(() => null);
      // a 201 on an untrapped submit means the record exists; the id is only for analytics.
      // This is the only place sign_up fires, and the submitting guard above stops a second request.
      if (res.status === 201) {
        const id = body?.user?.id;
        if (!trapped) track('sign_up', typeof id === 'string' ? { method: 'email', user_id: id } : { method: 'email' });
        return setState({ status: 'success', user: parsed.data });
      }
      if ((res.status === 400 || res.status === 409) && body?.error?.fields) {
        return settle(body.error.fields, res.status === 409 ? 'email_taken' : 'validation');
      }
      settle({}, 'server', GENERIC_ERROR);
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
      settle(
        {},
        timedOut ? 'timeout' : 'network',
        timedOut
          ? 'This is taking longer than it should. Check your connection and try again.'
          : "We couldn't reach our servers. Check your connection and try again.",
      );
    }
  }

  if (state.status === 'success') {
    return (
      <div className="signup signup--done" role="status">
        {/* aria-describedby so screen readers read the demo disclosure when focus lands on the heading */}
        <h2 ref={successRef} tabIndex={-1} className="signup__title" aria-describedby="signup-done-detail">
          You're in, {state.user.name}.
        </h2>
        <p id="signup-done-detail" className="signup__lead">
          We've saved your signup for <strong>{state.user.email}</strong>. This is a demo build, so it stores a
          signup record rather than creating a live FX Replay account.
        </p>
      </div>
    );
  }

  return (
    <form
      className="signup"
      method="post"
      onSubmit={onSubmit}
      noValidate
      aria-describedby="signup-lead"
    >
      <h2 className="signup__title">Try FX Replay Free</h2>
      <p id="signup-lead" className="signup__lead">
        Your email and name. That's all it takes. (Demo build: this saves a signup record, not a live account.)
      </p>

      <Field
        id="signup-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email}
        readOnly={submitting}
        onChange={revalidate}
        onFocus={markStarted}
      />
      <Field
        id="signup-name"
        name="name"
        label="Name"
        type="text"
        autoComplete="name"
        error={errors.name}
        readOnly={submitting}
        onChange={revalidate}
        onFocus={markStarted}
      />

      <div className="signup__trap" aria-hidden="true">
        <label htmlFor="signup-trap">Leave this empty</label>
        <input id="signup-trap" name={TRAP_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <p id="signup-form-error" tabIndex={-1} className="signup__form-error" role="alert">
        {state.status === 'idle' ? state.formError : null}
      </p>
      <p className="visually-hidden" role="status">
        {submitting ? 'Creating your account' : ''}
      </p>

      {/* aria-disabled instead of disabled keeps focus on the button while the request runs */}
      <button type="submit" className="btn signup__submit" disabled={!hydrated} aria-disabled={submitting || undefined}>
        {submitting ? 'Creating your account…' : 'Create free account'}
      </button>
    </form>
  );
}

type FieldProps = {
  id: string;
  name: keyof CreateUserInput;
  label: string;
  type: string;
  autoComplete: string;
  inputMode?: 'email';
  error?: string;
  readOnly: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
};

function Field({ id, label, error, ...input }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="signup__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      {error && (
        <p id={errorId} className="signup__error">
          {error}
        </p>
      )}
    </div>
  );
}
