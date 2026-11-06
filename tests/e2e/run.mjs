/**
 * Pruebas de navegador de extremo a extremo con Playwright.
 *
 * Uso: npm run build && npm run test:e2e
 * Sirve dist/ con un servidor estático propio y prueba la aplicación real.
 * Requiere Playwright con Chromium instalado (no es dependencia del proyecto
 * para no inflar la instalación en Render).
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startStaticServer } from './static-server.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright no está instalado. Instálalo con: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const PORT = 4329;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL('../..', import.meta.url));
const shotsDir = fileURLToPath(new URL('./screenshots/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

const DEFAULT_LETTERS = 'A B C D E F G H I J L M N Ñ O P R S T U V'.split(' ');

// ------------------------------------------------------------------ servidor

const server = await startStaticServer(fileURLToPath(new URL('dist/', `file://${root}/`)), PORT);

// --------------------------------------------------------------- mini runner

const results = [];
async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✗ ${name}\n    ${String(error?.message ?? error).split('\n').join('\n    ')}`);
  }
}

const browser = await chromium.launch();

async function newPage(options = {}) {
  const context = await browser.newContext({ locale: 'es-ES', ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  return { context, page, errors };
}

const letterOf = (page) => page.locator('[data-el="letter"]').textContent().then((t) => t.trim());
const categoriesOf = (page) => page.locator('[data-el="cats"] .cats__name').allTextContents();
const timeOf = (page) => page.locator('[data-el="time"]').textContent().then((t) => t.trim());
const ready = (page) => page.waitForSelector('[data-game][data-ready="true"]');

console.log('\nGenerador principal');

await test('carga sin errores y muestra el estado inicial', async () => {
  const { page, errors, context } = await newPage();
  await page.goto(`${BASE}/`);
  await ready(page);
  assert.equal(await letterOf(page), '?');
  assert.equal((await categoriesOf(page)).length, 0);
  assert.equal(await timeOf(page), '2:00');
  assert.equal(await page.locator('h1').count(), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

await test('nueva ronda: letra válida y 12 categorías distintas', async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  const letter = await letterOf(page);
  assert.ok(DEFAULT_LETTERS.includes(letter), `letra inesperada: ${letter}`);
  const cats = await categoriesOf(page);
  assert.equal(cats.length, 12);
  assert.equal(new Set(cats).size, 12);
  assert.match(await page.locator('[data-el="round-label"]').textContent(), /Ronda 1/);
  await context.close();
});

await test('letra y categorías se regeneran de forma independiente', async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  const letter1 = await letterOf(page);
  const cats1 = await categoriesOf(page);
  await page.getByRole('button', { name: 'Otra letra' }).click();
  const letter2 = await letterOf(page);
  assert.notEqual(letter2, letter1);
  assert.deepEqual(await categoriesOf(page), cats1, 'las categorías no deben cambiar');
  await page.getByRole('button', { name: 'Otras categorías' }).click();
  assert.equal(await letterOf(page), letter2, 'la letra no debe cambiar');
  const cats3 = await categoriesOf(page);
  assert.notDeepEqual(cats3, cats1);
  assert.equal(cats3.length, 12);
  await context.close();
});

await test('no repite letras hasta agotar las 21 por defecto', async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/`);
  await ready(page);
  const seen = [];
  for (let i = 0; i < DEFAULT_LETTERS.length; i++) {
    await page.getByRole('button', { name: 'Nueva ronda' }).click();
    seen.push(await letterOf(page));
  }
  assert.equal(new Set(seen).size, DEFAULT_LETTERS.length, `repetidas: ${seen.join('')}`);
  assert.deepEqual([...seen].sort(), [...DEFAULT_LETTERS].sort());
  assert.match(await page.locator('[data-el="remaining"]').textContent(), /Quedan 0 de 21/);
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  assert.match(await page.locator('[data-el="toast"]').textContent(), /todas las letras/);
  await page.getByRole('button', { name: 'Reiniciar letras' }).click();
  assert.match(await page.locator('[data-el="remaining"]').textContent(), /21 letras en juego/);
  await context.close();
});

await test('número de categorías, cambiar y descartar una categoría', async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  await page.getByRole('button', { name: 'Una categoría más' }).click();
  assert.equal((await categoriesOf(page)).length, 13);
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Una categoría menos' }).click();
  assert.equal((await categoriesOf(page)).length, 5, 'mínimo 5');
  assert.ok(await page.getByRole('button', { name: 'Una categoría menos' }).isDisabled());

  const before = await categoriesOf(page);
  await page.locator('[data-swap="2"]').click();
  const after = await categoriesOf(page);
  assert.notEqual(after[2], before[2]);
  assert.deepEqual(after.filter((_, i) => i !== 2), before.filter((_, i) => i !== 2));

  const discarded = after[0];
  await page.locator('[data-discard="0"]').click();
  const afterDiscard = await categoriesOf(page);
  assert.ok(!afterDiscard.includes(discarded));
  assert.equal(afterDiscard.length, 5);
  for (let i = 0; i < 15; i++) {
    await page.getByRole('button', { name: 'Otras categorías' }).click();
    assert.ok(!(await categoriesOf(page)).includes(discarded), 'una categoría descartada no debe volver');
  }
  await context.close();
});

await test('copiar al portapapeles', async () => {
  const { page, context } = await newPage();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  await page.getByRole('button', { name: 'Copiar' }).click();
  await page.waitForFunction(() => document.querySelector('[data-el="copy-label"]')?.textContent === '¡Copiado!');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const letter = await letterOf(page);
  const cats = await categoriesOf(page);
  assert.ok(text.includes(`Letra: ${letter}`), text);
  assert.ok(text.includes(`1. ${cats[0]}`), text);
  assert.ok(text.includes(`12. ${cats[11]}`), text);
  await context.close();
});

await test('temporizador: empezar, pausar, reanudar, reiniciar y alarma', async () => {
  const { page, context } = await newPage();
  await page.clock.install();
  await page.goto(`${BASE}/`);
  await ready(page);
  const start = page.locator('[data-action="timer"]');
  await start.click();
  assert.equal(await page.locator('[data-el="timer"]').getAttribute('data-status'), 'running');
  await page.clock.runFor(5_000);
  assert.equal(await timeOf(page), '1:55');
  await start.click(); // pausa
  assert.equal(await page.locator('[data-el="timer"]').getAttribute('data-status'), 'paused');
  assert.equal(await start.textContent().then((t) => t.trim()), 'Reanudar');
  await page.clock.runFor(10_000);
  assert.equal(await timeOf(page), '1:55', 'en pausa no avanza');
  await start.click(); // reanuda
  await page.clock.runFor(3_000);
  assert.equal(await timeOf(page), '1:52');
  await page.getByRole('button', { name: 'Reiniciar', exact: true }).click();
  assert.equal(await timeOf(page), '2:00');
  await page.clock.runFor(5_000);
  assert.equal(await timeOf(page), '2:00', 'tras reiniciar no sigue corriendo');

  await page.locator('[data-duration="60"]').click();
  assert.equal(await timeOf(page), '1:00');
  await start.click();
  await page.clock.runFor(61_000);
  assert.equal(await page.locator('[data-el="timer"]').getAttribute('data-status'), 'finished');
  assert.equal(await timeOf(page), '0:00');
  assert.ok(await page.locator('[data-game]').evaluate((el) => el.classList.contains('is-timeup')));
  assert.match(await page.locator('[data-el="timer-announcer"]').textContent(), /Tiempo/);
  await context.close();
});

await test('duración personalizada y nueva ronda reinicia el temporizador', async () => {
  const { page, context } = await newPage();
  await page.clock.install();
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.locator('[data-action="custom-time"]').click();
  await page.locator('input[name="min"]').fill('0');
  await page.locator('input[name="sec"]').fill('45');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  assert.equal(await timeOf(page), '0:45');
  await page.locator('[data-action="timer"]').click();
  await page.clock.runFor(10_000);
  assert.equal(await timeOf(page), '0:35');
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  assert.equal(await timeOf(page), '0:45');
  assert.equal(await page.locator('[data-el="timer"]').getAttribute('data-status'), 'idle');
  await page.reload();
  await ready(page);
  assert.equal(await timeOf(page), '0:45', 'la duración se guarda');
  await context.close();
});

await test('ajustes: pack, categorías propias, letras y persistencia', async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  await page.locator('[data-action="settings"]').click();
  const dialog = page.getByRole('dialog', { name: 'Ajustes' });
  assert.ok(await dialog.isVisible());

  // Cambiar de pack actualiza el indicador (la pureza de cada pack se prueba aparte).
  await dialog.getByLabel(/Divertido/).check();
  assert.match(await page.locator('[data-el="pack-name"]').textContent(), /Divertido/);

  // Categorías propias en modo «solo las mías».
  const mine = ['Villano de película', 'Comida rápida', 'Palabra en inglés', 'Algo de plástico', 'Pokémon', 'Rapero'];
  for (const c of mine) {
    await dialog.getByLabel('Nueva categoría').fill(c);
    await dialog.getByLabel('Nueva categoría').press('Enter');
  }
  assert.ok(await dialog.isVisible(), 'Enter no debe cerrar el diálogo');
  assert.equal(await dialog.locator('[data-el="custom-list"] li').count(), mine.length);
  await dialog.getByLabel('Solo las mías').check();

  // Solo la letra Ñ.
  await dialog.getByRole('button', { name: 'Letras por defecto' }).click();
  for (const l of DEFAULT_LETTERS.filter((x) => x !== 'Ñ')) {
    await dialog.locator(`input[name="letters"][value="${l}"]`).uncheck({ force: true });
  }
  assert.match(await dialog.locator('[data-el="letters-count"]').textContent(), /^1 de 27/);
  await dialog.locator('input[name="letters"][value="Ñ"]').click({ force: true });
  assert.ok(await dialog.locator('input[name="letters"][value="Ñ"]').isChecked(), 'no se puede quedar sin letras');

  await dialog.getByRole('button', { name: 'Listo' }).click();
  assert.ok(!(await dialog.isVisible()));

  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  assert.equal(await letterOf(page), 'Ñ');
  const cats = await categoriesOf(page);
  assert.equal(cats.length, mine.length, 'solo hay 6 categorías propias');
  cats.forEach((c) => assert.ok(mine.includes(c), `categoría ajena: ${c}`));

  // Persistencia tras recargar.
  await page.reload();
  await ready(page);
  assert.equal(await letterOf(page), 'Ñ');
  assert.deepEqual(await categoriesOf(page), cats);
  assert.match(await page.locator('[data-el="pack-name"]').textContent(), /Mis categorías/);

  // «No usarlas» vuelve al pack elegido sin tus categorías.
  await page.locator('[data-action="settings"]').click();
  await dialog.getByLabel('No usarlas').check();
  await page.keyboard.press('Escape');
  assert.match(await page.locator('[data-el="pack-name"]').textContent(), /Divertido/);
  await page.getByRole('button', { name: 'Otras categorías' }).click();
  const fun = await categoriesOf(page);
  assert.equal(fun.length, 12);
  fun.forEach((c) => assert.ok(!mine.includes(c), `no debería salir «${c}»`));
  await context.close();
});

await test('los packs no se mezclan', async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/categorias-stop/`);
  await ready(page);
  const packs = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.pack-list')].map((section) => [
        section.querySelector('h3').id.replace('pack-', ''),
        [...section.querySelectorAll('li')].map((li) => li.textContent.trim()),
      ]),
    ),
  );
  assert.equal(Object.keys(packs).length, 6);
  for (const id of Object.keys(packs)) {
    await page.locator('[data-action="settings"]').click();
    await page.locator(`input[name="pack"][value="${id}"]`).check();
    await page.getByRole('button', { name: 'Listo' }).click();
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: 'Nuevas categorías' }).click();
      const cats = await categoriesOf(page);
      assert.equal(cats.length, 12);
      cats.forEach((c) => assert.ok(packs[id].includes(c), `«${c}» no es del pack ${id}`));
    }
  }
  await context.close();
});

await test('atajos de teclado', async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  const l1 = await letterOf(page);
  assert.notEqual(l1, '?');
  const cats = await categoriesOf(page);
  await page.keyboard.press('l');
  assert.notEqual(await letterOf(page), l1);
  assert.deepEqual(await categoriesOf(page), cats);
  await page.keyboard.press('t');
  assert.equal(await page.locator('[data-el="timer"]').getAttribute('data-status'), 'running');
  await page.keyboard.press('t');
  assert.equal(await page.locator('[data-el="timer"]').getAttribute('data-status'), 'paused');
  await context.close();
});

await test('pantalla completa', async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/`);
  await ready(page);
  const btn = page.locator('[data-action="fullscreen"]');
  await btn.click();
  await page.waitForFunction(
    () =>
      document.fullscreenElement === document.querySelector('[data-game]') ||
      document.querySelector('[data-game]').classList.contains('is-focus'),
  );
  assert.equal(await btn.getAttribute('aria-pressed'), 'true');
  await btn.click();
  await page.waitForFunction(() => !document.fullscreenElement && !document.querySelector('.is-focus'));
  assert.equal(await btn.getAttribute('aria-pressed'), 'false');
  await context.close();
});

await test('pantalla completa sin API (modo enfoque de respaldo)', async () => {
  const { page, context } = await newPage();
  await page.addInitScript(() => {
    // Simula un navegador sin API de pantalla completa (p. ej. Safari en iPhone).
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });
  });
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.locator('[data-action="fullscreen"]').click();
  assert.ok(await page.locator('[data-game]').evaluate((el) => el.classList.contains('is-focus')));
  await page.keyboard.press('Escape');
  assert.ok(!(await page.locator('[data-game]').evaluate((el) => el.classList.contains('is-focus'))));
  await context.close();
});

await test('reiniciar partida', async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  await page.getByRole('button', { name: 'Reiniciar partida' }).click();
  assert.equal(await letterOf(page), '?');
  assert.equal((await categoriesOf(page)).length, 0);
  assert.match(await page.locator('[data-el="round-label"]').textContent(), /Preparado/);
  await context.close();
});

await test('funciona aunque localStorage esté bloqueado', async () => {
  const { page, errors, context } = await newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Bloqueado', 'SecurityError');
      },
    });
  });
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  assert.equal((await categoriesOf(page)).length, 12);
  assert.deepEqual(errors, []);
  await context.close();
});

console.log('\nPáginas secundarias');

await test('/generador-letras/: solo letras', async () => {
  const { page, errors, context } = await newPage();
  await page.goto(`${BASE}/generador-letras/`);
  await ready(page);
  assert.equal(await page.locator('[data-el="cats"]').count(), 0);
  const seen = [];
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Nueva letra' }).click();
    seen.push(await letterOf(page));
  }
  assert.equal(new Set(seen).size, 5);
  assert.equal(await page.locator('[data-el="used"] li').count(), 5);
  assert.deepEqual(errors, []);
  await context.close();
});

await test('/categorias-stop/: solo categorías y columnas clásicas', async () => {
  const { page, errors, context } = await newPage();
  await page.goto(`${BASE}/categorias-stop/`);
  await ready(page);
  assert.equal(await page.locator('[data-el="letter"]').count(), 0);
  await page.getByRole('button', { name: 'Nuevas categorías' }).click();
  assert.equal((await categoriesOf(page)).length, 12);
  await page.getByRole('button', { name: 'Columnas clásicas' }).click();
  const cats = await categoriesOf(page);
  assert.equal(cats[0], 'Nombre');
  assert.equal(cats.length, 10);
  assert.ok((await page.locator('.pack-list li').count()) >= 120);
  assert.deepEqual(errors, []);
  await context.close();
});

for (const path of ['/tutti-frutti/', '/basta/']) {
  await test(`${path}: ronda completa y columnas`, async () => {
    const { page, errors, context } = await newPage();
    await page.goto(`${BASE}${path}`);
    await ready(page);
    await page.getByRole('button', { name: 'Nueva ronda' }).click();
    assert.notEqual(await letterOf(page), '?');
    await page.locator('[data-action="preset"]').click();
    assert.equal((await categoriesOf(page))[0], 'Nombre');
    assert.deepEqual(errors, []);
    await context.close();
  });
}

await test('404 personalizada', async () => {
  const { page, context } = await newPage();
  const res = await page.goto(`${BASE}/no-existe/`);
  assert.equal(res.status(), 404);
  assert.match(await page.locator('h1').textContent(), /no existe/);
  await context.close();
});

console.log('\nSEO');

for (const path of ['/', '/generador-letras/', '/categorias-stop/', '/tutti-frutti/', '/basta/']) {
  await test(`metadatos de ${path}`, async () => {
    const { page, context } = await newPage();
    await page.goto(`${BASE}${path}`);
    const meta = await page.evaluate(() => {
      const attr = (sel, a = 'content') => document.querySelector(sel)?.getAttribute(a) ?? null;
      return {
        title: document.title,
        description: attr('meta[name="description"]'),
        canonical: attr('link[rel="canonical"]', 'href'),
        ogTitle: attr('meta[property="og:title"]'),
        ogImage: attr('meta[property="og:image"]'),
        twitter: attr('meta[name="twitter:card"]'),
        lang: document.documentElement.lang,
        h1: document.querySelectorAll('h1').length,
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)),
        imgsWithoutAlt: document.querySelectorAll('img:not([alt])').length,
      };
    });
    assert.equal(meta.lang, 'es');
    assert.equal(meta.h1, 1);
    assert.ok(meta.title.length >= 30 && meta.title.length <= 80, `título: ${meta.title.length}`);
    assert.ok(meta.description.length >= 110 && meta.description.length <= 170, `descripción: ${meta.description.length}`);
    assert.ok(meta.canonical.endsWith(path), meta.canonical);
    assert.ok(meta.ogTitle && meta.ogImage && meta.twitter === 'summary_large_image');
    assert.ok(meta.jsonLd.length >= 1);
    assert.equal(meta.imgsWithoutAlt, 0);
    await context.close();
  });
}

await test('sitemap.xml y robots.txt', async () => {
  const { page, context } = await newPage();
  const sitemap = await (await page.goto(`${BASE}/sitemap.xml`)).text();
  for (const p of ['/', '/generador-letras/', '/categorias-stop/', '/tutti-frutti/', '/basta/']) {
    assert.ok(sitemap.includes(`${p}</loc>`), `falta ${p}`);
  }
  const robots = await (await page.goto(`${BASE}/robots.txt`)).text();
  assert.match(robots, /Sitemap: https?:\/\/.+\/sitemap\.xml/);
  await context.close();
});

console.log('\nDiseño adaptable');

const VIEWPORTS = [
  { name: 'movil-pequeno', width: 320, height: 568 },
  { name: 'movil-grande', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'escritorio', width: 1440, height: 900 },
];

for (const vp of VIEWPORTS) {
  await test(`${vp.name} (${vp.width}×${vp.height}): sin scroll horizontal y controles accesibles`, async () => {
    const { page, context } = await newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 800 });
    for (const path of ['/', '/generador-letras/', '/categorias-stop/', '/basta/']) {
      await page.goto(`${BASE}${path}`);
      await ready(page);
      const main = page.locator('[data-action="new"]');
      await main.click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${path}: desborda ${overflow}px`);
      const box = await main.boundingBox();
      assert.ok(box.height >= 44, `botón principal demasiado pequeño (${box.height}px)`);
      if (path === '/') {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(600); // deja terminar las animaciones
        await page.screenshot({ path: `${shotsDir}${vp.name}.png`, fullPage: false });
        await page.locator('[data-game]').screenshot({ path: `${shotsDir}${vp.name}-juego.png` });
        // Ninguna categoría se corta horizontalmente.
        const clipped = await page.evaluate(() =>
          [...document.querySelectorAll('.cats li')].some((li) => li.scrollWidth > li.clientWidth + 1),
        );
        assert.ok(!clipped, 'alguna categoría se sale de su fila');
      }
    }
    await page.goto(`${BASE}/`);
    await ready(page);
    await page.locator('[data-action="settings"]').click();
    const dialogBox = await page.getByRole('dialog').boundingBox();
    assert.ok(dialogBox.width <= vp.width, 'el diálogo cabe en pantalla');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shotsDir}${vp.name}-ajustes.png` });
    await context.close();
  });
}

await test('modo oscuro sin errores visuales graves', async () => {
  const { page, context } = await newPage({ colorScheme: 'dark', viewport: { width: 414, height: 896 } });
  await page.goto(`${BASE}/`);
  await ready(page);
  await page.getByRole('button', { name: 'Nueva ronda' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shotsDir}movil-oscuro.png`, fullPage: true });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(bg, 'rgb(251, 244, 232)');
  await context.close();
});

// ------------------------------------------------------------------- final

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas`);
if (failed.length > 0) {
  console.log(`Fallidas: ${failed.map((f) => f.name).join(', ')}`);
  process.exit(1);
}
