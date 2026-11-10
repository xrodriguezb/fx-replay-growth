import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// unique per run, because the dev server's in-memory store keeps users between tests
const email = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // the submit button only enables once React has mounted the form, the same gate real users get
  await expect(page.getByRole('button', { name: 'Create free account' })).toBeEnabled();
});

test('signs up and lands on the success state', async ({ page }) => {
  await page.getByLabel('Email').fill(email('ok'));
  await page.getByLabel('Name').fill('Ana');
  await page.getByRole('button', { name: 'Create free account' }).click();

  const heading = page.getByRole('heading', { name: "You're in, Ana." });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  // the demo must never read as a real FX Replay account
  await expect(page.getByRole('status').filter({ hasText: 'rather than creating a live FX Replay account' })).toBeVisible();
  await expect(heading).toHaveAccessibleDescription(/rather than creating a live FX Replay account/);
});

test('shows inline errors and focuses the first bad field', async ({ page }) => {
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Create free account' }).click();

  await expect(page.getByText('Enter a valid email address')).toBeVisible();
  await expect(page.getByText('Enter your name')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeFocused();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
});

test('tells people when the email has already signed up', async ({ page }) => {
  const taken = email('dup');
  await page.request.post('/api/users', { data: { email: taken, name: 'First' } });

  await page.getByLabel('Email').fill(taken);
  await page.getByLabel('Name').fill('Second');
  await page.getByRole('button', { name: 'Create free account' }).click();

  await expect(page.getByText('This email has already signed up')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeFocused();
});

test('keeps the details and offers a retry when the network fails', async ({ page }) => {
  await page.route('/api/users', (route) => route.abort('internetdisconnected'));
  await page.getByLabel('Email').fill(email('net'));
  await page.getByLabel('Name').fill('Ana');
  await page.getByRole('button', { name: 'Create free account' }).click();

  await expect(page.getByRole('alert')).toContainText("We couldn't reach our servers");
  await expect(page.getByLabel('Name')).toHaveValue('Ana');

  await page.unroute('/api/users');
  await page.getByRole('button', { name: 'Create free account' }).click();
  await expect(page.getByRole('heading', { name: "You're in, Ana." })).toBeVisible();
});

test('shows a loading state and blocks double submits', async ({ page }) => {
  let calls = 0;
  await page.route('/api/users', async (route) => {
    calls++;
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.getByLabel('Email').fill(email('slow'));
  await page.getByLabel('Name').fill('Ana');
  await page.getByRole('button', { name: 'Create free account' }).click();

  const pending = page.getByRole('button', { name: 'Creating your account…' });
  await expect(pending).toHaveAttribute('aria-disabled', 'true');
  await expect(pending).toBeFocused();
  await page.getByLabel('Name').press('Enter'); // second submit while the first is in flight
  await expect(page.getByRole('heading', { name: "You're in, Ana." })).toBeVisible();
  expect(calls).toBe(1);
  const signUps = await page.evaluate(() => (window.dataLayer ?? []).filter((e) => e.event === 'sign_up').length);
  expect(signUps).toBe(1);
});

test('ships a form that can not submit before hydration', async ({ request }) => {
  // a native submit before React takes over would reload the page and drop what was typed
  const html = await (await request.get('/')).text();
  expect(html).toMatch(/<form[^>]*method="post"/);
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
});

test('has no detectable accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
