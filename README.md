# LetraLista — generador de Scattergories en español

Generador gratuito para jugar a **Scattergories, Stop, Basta o Tutti Frutti** en español: letra al azar sin repetir, listas de categorías, temporizador y ajustes, sin registro y sin backend.

Es un sitio estático (Astro + TypeScript) listo para publicar en **Render** como Static Site.

## Funcionalidades

- **Letra al azar** del abecedario español (27 letras, con Ñ). Por defecto juegan 21 letras (`A B C D E F G H I J L M N Ñ O P R S T U V`); K, Q, W, X, Y y Z se pueden activar todas a la vez o una a una.
- **Sin repeticiones** hasta agotar las letras activas; luego empieza un ciclo nuevo sin repetir la última letra. El historial se puede reiniciar.
- **Aleatoriedad real**: `crypto.getRandomValues()` con muestreo por rechazo (sin sesgo de módulo) y Fisher–Yates. No hay secuencias predefinidas.
- **Categorías**: 286 categorías (275 distintas) en 6 packs: Clásico (por defecto), Fácil / niños, Difícil, Cultura general, Divertido y Creativo. Las categorías de un pack nunca se mezclan con las de otro.
- Listas de **5 a 20** categorías sin duplicados; cambiar la lista entera, cambiar una sola categoría o descartarla para siempre (se puede recuperar).
- **Categorías propias**: añadir y eliminar, y elegir entre mezclarlas con el pack, usar solo las tuyas o no usarlas.
- **Rondas**: nueva ronda (letra + categorías), regenerar letra o categorías por separado, reiniciar partida.
- **Temporizador**: 1:00, 1:30, 2:00, 3:00 o duración personalizada; empezar, pausar, reanudar y reiniciar. Basado en marcas de tiempo, así que no se desfasa si el móvil ralentiza la pestaña. Alarma sonora (Web Audio, sin archivos), vibración y aviso visual; anuncios para lectores de pantalla. Se reinicia al empezar una ronda nueva o reiniciar la partida.
- **Copiar** la ronda al portapapeles, **imprimir** la hoja de juego, **pantalla completa** (con modo enfoque de respaldo en navegadores sin la API, como Safari en iPhone), activar/desactivar el **sonido** y **atajos de teclado** (N, L, C, T, F).
- Ajustes y estado de la partida guardados en `localStorage`; si no está disponible, la app sigue funcionando en memoria.
- Modo oscuro automático, `prefers-reduced-motion`, foco visible y navegación completa con teclado.

## Páginas

| Ruta | Contenido |
| --- | --- |
| `/` | Generador completo (letra + categorías + temporizador), reglas y preguntas frecuentes |
| `/generador-letras/` | Generador solo de letras, con el abecedario y el historial |
| `/categorias-stop/` | Generador solo de categorías y listado completo de todos los packs |
| `/tutti-frutti/` | Generador con las columnas clásicas del Tutti Frutti, reglas y puntuación |
| `/basta/` | Generador con las columnas habituales del Basta, reglas y variantes |

Además: `404.html`, `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, favicon e imagen Open Graph.

## Requisitos

- Node.js **22.23.4 o superior** (lo exige Astro 7). Ver `.node-version`.
- npm 9.6.5 o superior.

## Instalación y desarrollo

```bash
npm install
npm run dev        # http://localhost:4321
```

## Comprobaciones

```bash
npm test           # pruebas unitarias (Vitest) de la lógica del juego
npm run check      # comprobación de tipos de Astro/TypeScript
npm run build      # build de producción en dist/
npm run test:e2e   # pruebas en navegador (necesita el build y Playwright con Chromium)
```

Las pruebas de navegador usan Playwright, que **no** es dependencia del proyecto para que la instalación en Render sea ligera. Para ejecutarlas en tu equipo:

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npm run test:e2e
```

`npm run test:e2e` sirve `dist/` con un servidor estático propio (`tests/e2e/static-server.mjs`) y guarda capturas en `tests/e2e/screenshots/` (ignoradas por git).

## Build de producción

```bash
npm run build      # genera dist/
npm run preview    # sirve dist/ en local
```

La URL pública que se usa en la etiqueta canonical, el sitemap y Open Graph se toma de la variable de entorno `SITE_URL` (por defecto `https://spanish-scattergories.onrender.com`):

```bash
SITE_URL=https://www.tudominio.com npm run build
```

## Subir a GitHub

```bash
git init                      # si el repositorio aún no existe
git add .
git commit -m "LetraLista: generador de Scattergories en español"
git branch -M main
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin main
```

## Publicar en Render

### Opción A: Blueprint (recomendada)

1. En [Render](https://dashboard.render.com), pulsa **New → Blueprint**.
2. Conecta tu cuenta de GitHub y elige este repositorio.
3. Render detecta `render.yaml` y crea el servicio `spanish-scattergories` (Static Site) con:
   - Build command: `npm install && npm run build`
   - Publish directory: `./dist`
   - Variables: `NODE_VERSION=22` y `SITE_URL`
   - Cabeceras de caché para `/_astro/*` y `/fonts/*`
4. Pulsa **Apply**. Cada `git push` a la rama conectada vuelve a publicar el sitio.

### Opción B: Static Site manual

1. **New → Static Site** y elige el repositorio.
2. Build command: `npm install && npm run build`
3. Publish directory: `dist`
4. En **Environment** añade `NODE_VERSION` = `22` y `SITE_URL` = la URL final del sitio.

### Después de publicar

- Si Render asigna otra URL (por ejemplo porque el nombre `spanish-scattergories` está ocupado) o usas un dominio propio, actualiza `SITE_URL` en Render y vuelve a desplegar para que la canonical y el sitemap apunten a la URL correcta.
- No hace falta ninguna regla de reescritura: Astro genera una carpeta con `index.html` por ruta. Astro también genera `dist/404.html` como página de error.
- Para Google: da de alta el sitio en Search Console y envía `https://<tu-url>/sitemap.xml`.

## Estructura del proyecto

```
├── astro.config.mjs          # Configuración de Astro (site, barras finales, CSS en línea)
├── render.yaml               # Blueprint de Render
├── public/                   # Favicon, iconos, imagen OG, manifest y fuente
├── scripts/
│   └── generate-images.mjs   # Regenera los PNG (iconos y OG) con Playwright
├── src/
│   ├── components/           # Generator, SettingsDialog, Header, Footer, Faq…
│   ├── data/
│   │   ├── categories/       # Un archivo por pack + índice y columnas tradicionales
│   │   ├── letters/          # Alfabeto español, letras por defecto y difíciles
│   │   ├── schema.ts         # Datos estructurados (JSON-LD)
│   │   └── site.ts           # Nombre del sitio y navegación
│   ├── layouts/BaseLayout.astro  # <head> con SEO, Open Graph, Twitter y JSON-LD
│   ├── pages/                # Rutas, sitemap.xml.ts y robots.txt.ts
│   ├── scripts/game-ui.ts    # Controlador de la interfaz (DOM ↔ motor)
│   ├── styles/global.css     # Sistema de diseño (tokens, botones, tipografía)
│   ├── types/game.ts         # Tipos del dominio
│   └── utils/                # Lógica pura, independiente de la interfaz
│       ├── random.ts         # Aleatoriedad sin sesgo (Web Crypto)
│       ├── letters.ts        # Sorteo de letras sin repetición
│       ├── categories.ts     # Pool, selección, sustitución y deduplicado
│       ├── game.ts           # Rondas: nueva ronda, regenerar, reiniciar
│       ├── timer.ts          # Cuenta atrás
│       ├── settings.ts       # Ajustes por defecto y saneado
│       ├── storage.ts        # localStorage seguro con respaldo en memoria
│       ├── clipboard.ts      # Copiar con respaldo
│       ├── fullscreen.ts     # API de pantalla completa
│       └── sound.ts          # Alarma con Web Audio
└── tests/
    ├── unit/                 # Vitest
    └── e2e/                  # Playwright (navegador real)
```

## Añadir un pack de categorías

1. Crea `src/data/categories/mipack.ts` exportando un `CategoryPack` (copia la forma de `clasico.ts`). Incluye al menos 40 categorías para que las listas de 20 tengan variedad.
2. Añade su id al tipo `PackId` en `src/types/game.ts`.
3. Impórtalo y añádelo a `PACKS` en `src/data/categories/index.ts`.
4. Ejecuta `npm test`: las pruebas comprueban duplicados, tamaño mínimo y que el pack no se mezcle con otros.

## Licencias

- Código: del propietario del repositorio.
- Fuente *Bricolage Grotesque*: SIL Open Font License 1.1 (`public/fonts/LICENSE-bricolage-grotesque.txt`).
- «Scattergories» es una marca registrada de su propietario; este proyecto es independiente y no está afiliado a ella.
