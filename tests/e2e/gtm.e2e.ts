import { expect, test } from '@playwright/test';

// Regression: GA4 sends the full URL as page_location, so email-looking query values must be gone from the
// address bar before GTM loads. A bug in the first version skipped every other match.
test('strips email-looking params before GTM loads, keeps the safe ones', async ({ page }) => {
  let urlWhenGtmRequested = '';
  await page.route('**/gtm.js*', async (route) => {
    // runs when the GTM script is fetched, i.e. after the scrub must already have happened
    urlWhenGtmRequested = await page.evaluate(() => location.href);
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
  });

  await page.goto(
    '/?utm_source=newsletter&utm_medium=a%40b.com&utm_term=Ana%20Lopez&utm_campaign=launch&email=c@d.io' +
      '&phone=5551234567&first_name=Ana&utm_content=hero&ref=x%2540y.com',
  );
  await expect.poll(() => urlWhenGtmRequested).not.toBe('');

  const params = new URL(urlWhenGtmRequested).searchParams;
  expect([...params.keys()]).toEqual(['utm_source', 'utm_campaign', 'utm_content']);
  expect(params.get('utm_source')).toBe('newsletter');
  expect(urlWhenGtmRequested).not.toMatch(/@|%40/i);
});
