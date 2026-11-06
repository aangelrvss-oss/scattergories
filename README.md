# LetraLista — generador de Scattergories en español

Juego de grupo en español para **Scattergories, Stop, Basta o Tutti Frutti**: una pantalla compartida (móvil, tablet, portátil o tele) hace de anfitrión con la letra, las categorías y la cuenta atrás, y cada jugador escribe en su hoja de papel. Sin registro y sin backend.

## Cómo se juega una ronda

1. El anfitrión elige el número de categorías y la duración (en Ajustes o en el propio juego).
2. Pulsa **Presentar** para poner la pantalla en modo presentación (opcional, recomendado en grupo).
3. Pulsa **Nueva ronda**: aparecen la letra y las categorías.
4. Pulsa **Empezar**: los jugadores escriben en papel mientras corre el tiempo.
5. Al llegar a cero aparece un **¡STOP!** grande; después se ven de nuevo letra y categorías para comparar respuestas. Los puntos los apunta el grupo.
6. **Nueva ronda** para seguir (la letra nunca se repite hasta agotar el alfabeto).

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
- **Modo presentación** para pantalla compartida: pantalla completa (o una capa a pantalla completa en navegadores sin la API, como Safari en iPhone), letra enorme, categorías en rejilla que ajustan su tamaño automáticamente para caber y leerse de lejos, cuenta atrás grande, aviso visual de los últimos 10 segundos, **¡STOP!** a pantalla completa y estado de la ronda («Preparados», «¡A escribir!», «En pausa», «¡Stop!»). Durante la cuenta atrás solo quedan pausa, reinicio, ajustes y salir. La pantalla no se apaga mientras se presenta (Screen Wake Lock, donde el navegador lo admite). Probado de 320×568 a 3840×2160.
- **Móvil:** tras pulsar «Nueva ronda» la página sube hasta la ronda; la barra fija inferior lleva el botón principal y un temporizador compacto.
- **Copiar** la ronda al portapapeles, **imprimir** la hoja de juego, activar/desactivar el **sonido** y **atajos de teclado** (N, L, C, T, F) que solo actúan con el foco en el juego.
- «Nueva partida» pide confirmación; cambiar la duración durante una cuenta atrás no la interrumpe (se aplica en la siguiente); dos pestañas abiertas comparten el historial sin pisarse.
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

- Node.js **24** (recomendado; es la versión de `.node-version` y de Render) o **22.23.4 o superior**. Astro 7 se niega a arrancar con Node 22 anterior a 22.23.4.
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
   - Build command: `npm ci && npm run build`
   - Publish directory: `./dist`
   - Variables: `NODE_VERSION=24`, `SITE_URL` y `ASTRO_TELEMETRY_DISABLED=1`
   - Cabeceras de caché para `/_astro/*` y `/fonts/*`
4. Pulsa **Apply**. Cada `git push` a la rama conectada vuelve a publicar el sitio.

### Opción B: Static Site manual

1. **New → Static Site** y elige el repositorio.
2. Build command: `npm ci && npm run build`
3. Publish directory: `dist`
4. En **Environment** añade `NODE_VERSION` = `24` y `SITE_URL` = la URL final del sitio.

### Después de publicar (obligatorio antes de dar de alta en Google)

1. **Comprueba la URL real** que asigna Render. Si no es `https://spanish-scattergories.onrender.com` (el nombre puede estar ocupado) o usas un dominio propio, cambia `SITE_URL` en Render y vuelve a desplegar. Si no, la etiqueta canonical, el sitemap y Open Graph apuntarán a otra dirección.
2. Comprueba en el navegador:
   - Las 5 rutas responden: `/`, `/generador-letras/`, `/categorias-stop/`, `/tutti-frutti/`, `/basta/`.
   - `/no-existe/` muestra la página 404 propia (Astro genera `dist/404.html`; la documentación de Render no detalla este caso, así que hay que verlo).
   - `/basta` (sin barra final) redirige o muestra la misma página; la canonical apunta a `/basta/`.
   - «Ver código fuente»: la canonical y `og:url` usan la URL real; `/sitemap.xml` y `/robots.txt` también.
   - `curl -I https://<tu-url>/_astro/<archivo>.js` devuelve `Cache-Control: public, max-age=31536000, immutable`.
3. Prueba el **modo presentación** en un móvil real y, si puedes, en una tele: sonido con el interruptor de silencio del iPhone, pantalla que no se apaga, salida con «Salir».
4. Da de alta el sitio en Search Console y envía `/sitemap.xml`.

No hace falta ninguna regla de reescritura: Astro genera una carpeta con `index.html` por ruta.

## Multijugador online (futuro)

La versión actual es solo de pantalla compartida y no usa backend. La propuesta de arquitectura para salas online (códigos, QR, temporizador sincronizado, sesiones anónimas con Supabase) está en [`docs/multijugador.md`](docs/multijugador.md).

## Limitaciones conocidas

- En un móvil muy pequeño (320×568) con categorías largas, la lista puede desplazarse dentro de su caja en modo presentación antes de empezar la cuenta atrás (el tamaño mínimo de letra es 13 px; letra y tiempo siguen fijos).
- Con la pantalla bloqueada o la pestaña en segundo plano, el navegador puede retrasar la alarma hasta que vuelvas; el tiempo restante sí es exacto. El modo presentación evita que la pantalla se apague donde el navegador lo permite.
- La vibración no existe en iOS; el sonido depende del interruptor de silencio.
- Las pruebas de navegador se ejecutan en Chromium; Safari y Firefox no se han probado de forma automática.

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
│       ├── game.ts           # Rondas: nueva ronda, regenerar, reiniciar, fase de la ronda
│       ├── timer.ts          # Cuenta atrás
│       ├── settings.ts       # Ajustes por defecto y saneado
│       ├── storage.ts        # localStorage seguro con respaldo en memoria
│       ├── clipboard.ts      # Copiar con respaldo
│       ├── fullscreen.ts     # API de pantalla completa
│       ├── wakelock.ts       # Mantener la pantalla encendida al presentar
│       └── sound.ts          # Alarma con Web Audio
├── docs/
│   └── multijugador.md       # Propuesta de arquitectura para salas online
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
