import { defineConfig } from '@playwright/test';

// E2E_BASE_URL=https://… runs the same journeys against a deployment instead of local servers
const remote = process.env.E2E_BASE_URL;

// Uses the locally installed Chrome so nobody has to download browsers just to run the e2e suite.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.e2e.ts', // not .spec/.test, so Vitest doesn't pick these up
  use: { baseURL: remote ?? 'http://localhost:4321', channel: 'chrome' },
  webServer: remote ? undefined : [
    {
      // Astro 7 backgrounds `astro dev` when it detects an AI agent (AI_AGENT / CLAUDECODE), and Playwright
      // reads the parent exiting as a crash. Clearing those vars keeps the server in the foreground.
      command: 'env -u AI_AGENT -u CLAUDECODE npx astro dev',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
    },
    {
      // Production build with a fake GTM container, served as plain static files, only for the URL-scrubbing
      // regression test. Astro allows one dev server per project, so this one can't be a second `astro dev`.
      command:
        'env -u AI_AGENT -u CLAUDECODE PUBLIC_GTM_ID=GTM-E2ETEST npx astro build && python3 -m http.server 4400 -d .vercel/output/static',
      url: 'http://localhost:4400',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'desktop', testIgnore: 'gtm.e2e.ts', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', testIgnore: 'gtm.e2e.ts', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    // needs the local GTM build, so it doesn't run against a deployment
    ...(remote ? [] : [{ name: 'gtm', testMatch: 'gtm.e2e.ts', use: { baseURL: 'http://localhost:4400' } }]),
  ],
});
