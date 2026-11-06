// @ts-check
import { defineConfig } from 'astro/config';

/**
 * URL pública del sitio (canonical, sitemap, Open Graph).
 * En Render se define con la variable de entorno SITE_URL.
 */
const site = (process.env.SITE_URL || 'https://spanish-scattergories.onrender.com').replace(/\/+$/, '');

export default defineConfig({
  site,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },
  compressHTML: true,
});
