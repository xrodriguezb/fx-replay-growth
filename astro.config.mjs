// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // used for canonical / og:url; unset = those tags are skipped
  site: process.env.SITE_URL,
  integrations: [react()],
  adapter: vercel(),
  // keeps dev screenshots clean; the toolbar isn't used in this project
  devToolbar: { enabled: false },
});