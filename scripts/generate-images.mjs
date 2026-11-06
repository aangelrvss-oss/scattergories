/**
 * Genera los PNG de iconos y la imagen Open Graph a partir de HTML/SVG.
 * Uso: node scripts/generate-images.mjs (requiere Playwright con Chromium).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Playwright está preinstalado de forma global en el entorno de desarrollo.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = new URL('..', import.meta.url);
const out = (name) => fileURLToPath(new URL(`public/${name}`, root));
const fontData = readFileSync(new URL('public/fonts/bricolage-grotesque-latin-wght.v1.woff2', root)).toString('base64');
const fontFace = `@font-face{font-family:B;src:url(data:font/woff2;base64,${fontData}) format('woff2');font-weight:200 800}`;

const icon = (size, padding = 0) => `<!doctype html><html><head><style>
  html,body{margin:0;background:${padding ? '#fbf4e8' : 'transparent'}}
  .w{width:${size}px;height:${size}px;display:grid;place-items:center}
  svg{width:${size - padding * 2}px;height:${size - padding * 2}px}
</style></head><body><div class="w">${readFileSync(new URL('public/favicon.svg', root), 'utf8')}</div></body></html>`;

const og = `<!doctype html><html><head><style>${fontFace}
  *{box-sizing:border-box}
  body{margin:0;width:1200px;height:630px;background:#fbf4e8;font-family:B,sans-serif;color:#1f1b17;display:flex;align-items:center;gap:64px;padding:0 80px;position:relative;overflow:hidden}
  .tile{flex:none;width:330px;height:330px;border:6px solid #1f1b17;border-radius:44px;background:#fffdf8;display:grid;place-items:center;font-size:250px;font-weight:800;line-height:1;box-shadow:16px 16px 0 #c7361a,16px 16px 0 5px #1f1b17}
  h1{font-size:76px;line-height:1;margin:0 0 22px;letter-spacing:-2px;font-weight:800}
  h1 span{color:#c7361a}
  ul{list-style:none;margin:0;padding:0;font-size:31px;font-weight:600;line-height:1.5}
  li::before{content:"";display:inline-block;width:14px;height:14px;background:#c7361a;border-radius:3px;margin-right:16px;vertical-align:middle}
  .brand{position:absolute;left:80px;top:44px;font-size:34px;font-weight:800;letter-spacing:-1px}
  .bar{position:absolute;left:0;right:0;bottom:0;height:22px;background:#1f1b17}
</style></head><body>
  <div class="brand">LetraLista</div>
  <div class="tile">M</div>
  <div><h1>Scattergories <span>en español</span></h1>
  <ul><li>Letra al azar sin repetir</li><li>Más de 250 categorías</li><li>Temporizador incluido</li></ul></div>
  <div class="bar"></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
const shots = [
  ['favicon-32.png', 32, icon(32)],
  ['apple-touch-icon.png', 180, icon(180, 14)],
  ['icon-192.png', 192, icon(192)],
  ['icon-512.png', 512, icon(512)],
  ['icon-512-maskable.png', 512, icon(512, 70)],
];
for (const [name, size, html] of shots) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  // Fondo transparente salvo en los iconos que lo necesitan opaco.
  const opaque = name === 'apple-touch-icon.png' || name.includes('maskable');
  await page.screenshot({ path: out(name), omitBackground: !opaque });
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og);
await page.waitForTimeout(200);
await page.screenshot({ path: out('og-image.png') });
await browser.close();
console.log('Imágenes generadas en public/');
