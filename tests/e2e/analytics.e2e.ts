import { expect, test, type Page } from '@playwright/test';

// what the page pushed to window.dataLayer; this checks our instrumentation, not GA4 delivery.
// Only our own events: GTM adds gtm.* entries when a container is configured.
const OURS = ['landing_viewed', 'cta_clicked', 'signup_started', 'signup_submitted', 'signup_failed', 'sign_up'];
const events = async (page: Page) =>
  (await page.evaluate(() => (window.dataLayer ?? []) as Record<string, unknown>[])).filter((e) =>
    OURS.includes(e.event as string),
  );
const names = async (page: Page) => (await events(page)).map((e) => e.event);
const email = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

async function open(page: Page, query = '') {
  await page.goto(`/${query}`);
  // the submit button only enables once React has mounted the form, the same gate real users get
  await expect(page.getByRole('button', { name: 'Create free account' })).toBeEnabled();
}

async function submit(page: Page, emailValue: string, name: string) {
  await page.getByLabel('Email').fill(emailValue);
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create free account' }).click();
}

test('records the funnel in order, once, with attribution and no PII', async ({ page }) => {
  await open(page, '?utm_source=newsletter&utm_campaign=launch&utm_medium=someone%40example.com&utm_term=x%2540y.com&utm_content=Ana%20Lopez');
  await submit(page, email('funnel'), 'Ana');
  await expect(page.getByRole('heading', { name: "You're in, Ana." })).toBeVisible();

  expect(await names(page)).toEqual(['landing_viewed', 'signup_started', 'signup_submitted', 'sign_up']);

  const all = await events(page);
  const signUp = all.find((e) => e.event === 'sign_up')!;
  expect(signUp).toMatchObject({ method: 'email', utm_source: 'newsletter', utm_campaign: 'launch' });
  expect(signUp.user_id).toMatch(/^[0-9a-f-]{36}$/);
  // the UTM carrying an email is dropped, and nothing anywhere looks like an email
  expect(signUp).not.toHaveProperty('utm_medium');
  expect(signUp).not.toHaveProperty('utm_term');
  expect(signUp).not.toHaveProperty('utm_content'); // a name with a space isn't a campaign slug
  expect(JSON.stringify(all)).not.toMatch(/@/);
});

test('records why a signup failed, by field name only', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Create free account' }).click();

  const taken = email('taken');
  await page.request.post('/api/users', { data: { email: taken, name: 'First' } });
  await submit(page, taken, 'Second');
  await expect(page.getByText('This email has already signed up')).toBeVisible();

  await page.route('/api/users', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Create free account' }).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't reach our servers");

  await page.unroute('/api/users');
  await page.route('/api/users', (route) => route.fulfill({ status: 500, body: 'upstream exploded' }));
  await page.getByRole('button', { name: 'Create free account' }).click();
  await expect(page.getByRole('alert')).toContainText('Something went wrong on our side');

  const failures = (await events(page)).filter((e) => e.event === 'signup_failed');
  expect(failures).toEqual([
    { event: 'signup_failed', reason: 'validation', fields: 'email,name' },
    { event: 'signup_failed', reason: 'email_taken', fields: 'email' },
    { event: 'signup_failed', reason: 'network' },
    { event: 'signup_failed', reason: 'server' },
  ]);
  expect(await names(page)).not.toContain('sign_up');
  expect(JSON.stringify(await events(page))).not.toMatch(/@/);
});

test('counts signup_started even when no field was ever focused', async ({ page }) => {
  // autofill + a Safari click on the button never focuses an input
  await open(page);
  await page.evaluate((value) => {
    (document.getElementById('signup-email') as HTMLInputElement).value = value;
    (document.getElementById('signup-name') as HTMLInputElement).value = 'Ana';
    document.querySelector('form')!.requestSubmit();
  }, email('autofill'));
  await expect(page.getByRole('heading', { name: "You're in, Ana." })).toBeVisible();
  expect(await names(page)).toEqual(['landing_viewed', 'signup_started', 'signup_submitted', 'sign_up']);
});

test('a filled honeypot shows success but never counts as a signup', async ({ page }) => {
  // the server answers trapped submits with a fake 201 and stores nothing (tests/users-api.test.ts)
  await open(page);
  await page.evaluate(() => {
    (document.getElementById('signup-trap') as HTMLInputElement).value = 'http://spam.example';
  });
  await submit(page, email('bot'), 'Bot');
  await expect(page.getByRole('heading', { name: "You're in, Bot." })).toBeVisible();
  expect(await names(page)).toEqual(['landing_viewed', 'signup_started', 'signup_submitted']);
});

test('records clicks on the closing CTA', async ({ page }) => {
  await open(page);
  await page.getByRole('link', { name: 'Try FX Replay Free' }).click();
  expect((await events(page)).filter((e) => e.event === 'cta_clicked')).toEqual([
    { event: 'cta_clicked', cta_location: 'final_cta' },
  ]);
});
