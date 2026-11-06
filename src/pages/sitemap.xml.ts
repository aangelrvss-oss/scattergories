import type { APIRoute } from 'astro';
import { NAV } from '../data/site';

/** Sitemap XML generado en el build a partir de la navegación. */
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://spanish-scattergories.onrender.com');
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = NAV.map(
    (item) => `  <url>
    <loc>${new URL(item.href, base).href}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${item.href === '/' ? '1.0' : '0.8'}</priority>
  </url>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
