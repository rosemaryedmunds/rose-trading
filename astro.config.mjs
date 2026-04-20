import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://rose.trading',
  integrations: [
    icon({
      // This tells Astro exactly where to look for icons
      include: {
        lucide: ['*'], 
      },
    }),
  ],
});