# Salas online (multijugador): propuesta de arquitectura

> Estado: **propuesta, no implementada.** La versión actual es solo de pantalla
> compartida y funciona sin backend. Este documento describe cómo añadir salas
> online sin rehacer el juego.

## 1. Alcance por versión

| Función | Versión actual (pantalla compartida) | Futuro: salas online |
| --- | --- | --- |
| Letra sin repetir, categorías, packs | ✅ En el navegador | ✅ Generadas en el servidor con el mismo motor |
| Temporizador | ✅ Local | ✅ Sincronizado con la hora del servidor |
| Modo presentación (móvil, tablet, tele) | ✅ | ✅ La pantalla del anfitrión puede seguir siendo la «tele» |
| Ajustes y categorías propias | ✅ `localStorage` | Configuración de la sala, definida por el anfitrión |
| Cuentas | ❌ No hacen falta | ❌ Sesiones anónimas, sin registro |
| Sala con código / QR | ❌ | ✅ |
| Nombres de jugadores | ❌ | ✅ |
| Escribir respuestas en el móvil | ❌ (papel y boli) | ✅ Fase 3 |
| Puntuación | ❌ (la apunta el grupo) | ✅ Fase 3–4 (votación y, después, ayuda automática) |
| Backend / base de datos | ❌ Ninguno | Supabase (Realtime + Postgres + Edge Functions) |

## 2. ¿Sirve el motor actual?

**Sí, en lo esencial.** Lo que ya está preparado:

- **Reglas sin interfaz.** `src/utils/` (letras, categorías, rondas, fase de la
  ronda, temporizador) son funciones puras que no tocan el DOM. Se pueden
  importar tal cual desde una Edge Function (Deno) o desde Node.
- **Aleatoriedad inyectable.** Todas las funciones aceptan un `RandomInt`. En el
  servidor se usa el mismo `secureRandomInt` (Web Crypto existe en Deno y Node),
  así que las reglas de no repetición y de packs son idénticas.
- **Estado serializable.** `RoundState` es JSON plano: puede guardarse en una
  fila de Postgres y enviarse por Realtime sin conversión.
- **Fase de la ronda en el motor.** `getRoundPhase()` deriva «preparados /
  a escribir / en pausa / stop» del estado y del temporizador; cualquier
  dispositivo de la sala calculará lo mismo.
- **Temporizador por marca de tiempo.** `CountdownTimer` calcula el tiempo
  restante a partir de una hora de fin y acepta un reloj inyectable (`now`).

Lo que dificultaría el multijugador y conviene cambiar **antes** de empezarlo:

1. **El controlador mezcla estado, persistencia y pintado.**
   `src/scripts/game-ui.ts` guarda `state`/`settings` en variables locales y
   llama al motor directamente. Propuesta: extraer un `GameStore` con
   `getSnapshot()`, `subscribe()` y `dispatch(acción)`. Habría dos
   implementaciones: `LocalStore` (la de hoy, con `localStorage`) y
   `RoomStore` (envía la acción al servidor y pinta la instantánea que llega
   por Realtime). La interfaz no sabría cuál está usando.
2. **El temporizador solo se controla localmente.** Hay que añadir
   `syncTo({ status, endsAt, remainingMs }, offsetServidor)` para que la
   cuenta atrás siga al servidor en lugar de a los botones locales.
3. **Ajustes por dispositivo.** Pack, número de categorías, letras activas,
   categorías propias y duración pasan a ser `RoomConfig` (del anfitrión).
   Las preferencias de cada jugador (sonido, tema) siguen siendo locales.
4. **Historial de letras en `localStorage`.** En una sala, el historial es
   parte del estado de la sala, no del navegador.

Ninguno de estos cambios es necesario para la versión actual.

## 3. Arquitectura recomendada

```
Navegador (Astro estático en Render)          Supabase
┌──────────────────────────────┐   HTTPS   ┌──────────────────────────────┐
│ UI (misma interfaz + modo     │ ───────▶ │ Edge Functions (autoridad):    │
│ presentación)                 │          │  create-room, join-room,       │
│ RoomStore ── dispatch(acción) │          │  room-action, submit-answers   │
│        ▲                      │          │  (usan src/utils/ del juego)   │
│        │ instantáneas         │ ◀─────── │ Postgres + RLS                 │
│ Realtime: Broadcast+Presence  │ Realtime │ Realtime (cambios de `rooms`)  │
└──────────────────────────────┘          └──────────────────────────────┘
```

- **El sitio sigue siendo estático en Render.** Las salas viven en una ruta
  nueva (`/sala/`) que se pinta en el cliente; no hace falta servidor propio.
- **El servidor es la autoridad.** Los clientes nunca generan letras ni
  cambian el estado de la ronda: envían *intenciones* («nueva ronda»,
  «empezar», «pausar») a una Edge Function, que valida permisos, aplica el
  motor y escribe el nuevo estado. Realtime lo difunde a todos.

### Modelo de datos (Postgres)

| Tabla | Campos principales |
| --- | --- |
| `rooms` | `id`, `code` (único), `host_id`, `config` (jsonb: `RoomConfig`), `state` (jsonb: `RoundState`), `timer` (jsonb), `version` (int), `created_at`, `last_activity_at`, `status` (`lobby`/`playing`/`closed`) |
| `players` | `room_id`, `user_id`, `name`, `role` (`host`/`player`), `joined_at`, `last_seen_at`, `kicked` |
| `submissions` (fase 3) | `round_id`, `room_id`, `user_id`, `answers` (jsonb), `submitted_at`; único por (`round_id`, `user_id`) |

`version` se incrementa en cada cambio: los clientes ignoran instantáneas
antiguas que lleguen desordenadas.

## 4. Decisiones concretas

### Creación y caducidad de salas
- `create-room` crea la sala y al anfitrión como primer jugador.
- Caducidad: sala cerrada tras **12 h** desde su creación o **60 min** sin
  actividad. Un trabajo programado (`pg_cron`) marca `closed` y borra los datos
  a las 24 h. No se guarda nada personal más allá del nombre elegido.

### Códigos cortos
- 5 caracteres de un alfabeto sin ambigüedades (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`,
  31 símbolos ≈ 28 millones de combinaciones), generados con `secureRandomInt`.
- Unicidad garantizada por índice único entre salas activas; se reintenta si hay
  colisión.
- El código **no es un secreto**: la seguridad no depende de él (ver abajo), pero
  se limita la tasa de intentos de unión (p. ej. 10 por minuto e IP) para
  impedir el barrido de códigos.

### Unirse por QR
- El QR codifica `https://<dominio>/sala/?c=CODIGO`. Se genera en el cliente
  (librería pequeña y sin red) y se muestra en la pantalla del anfitrión, en
  modo presentación.

### Roles
- **Anfitrión:** cambia la configuración, genera rondas, controla el tiempo,
  expulsa jugadores, cierra la sala.
- **Jugador:** ve la ronda, (fase 3) envía respuestas y vota.
- La Edge Function comprueba el rol con el `user_id` de la sesión; RLS impide
  escribir directamente en `rooms` desde el cliente.

### Sesiones anónimas
- Supabase Auth con **inicio de sesión anónimo**: cada navegador obtiene un
  `user_id` estable sin registro. Se guarda en el propio navegador y permite
  reconectarse a la misma sala con el mismo nombre y rol.

### Reconexión
- Al volver (recarga, cambio de red, pantalla bloqueada) el cliente se
  resuscribe, pide la instantánea actual (`rooms.state`, `timer`, `version`) y
  recalcula el tiempo con el desfase de reloj. Nada depende de haber recibido
  todos los mensajes intermedios.
- Presencia (Realtime Presence) marca a los jugadores como conectados o no;
  un jugador desconectado sigue en la sala hasta que caduque.

### Ronda autoritativa y temporizador sincronizado
- El estado del temporizador se guarda como
  `{ status, durationMs, endsAt (hora servidor), remainingMs (si está en pausa) }`.
- Cada cliente estima su **desfase de reloj** con varias peticiones a una
  función `time` (estilo NTP: se toma la de menor ida y vuelta) y calcula
  `restante = endsAt − (ahora_local + desfase)`. Así todos ven el mismo segundo
  aunque los mensajes lleguen con retraso.
- El «¡STOP!» lo decide el servidor (`endsAt`), no cada dispositivo.

### Respuestas tardías o duplicadas (fase 3)
- Una fila por (`round_id`, `user_id`): se permite **actualizar** hasta el
  cierre; los reintentos de red no duplican.
- Se aceptan envíos hasta `endsAt + 2 s` de margen (latencia); después la
  función los rechaza con un error claro. El cliente envía automáticamente lo
  escrito al llegar a cero.

### Seguridad de la sala
- RLS: solo los jugadores de una sala pueden leerla; nadie escribe en `rooms`
  desde el cliente.
- Límite de tamaño de nombres y respuestas; filtro básico de palabras.
- El anfitrión puede expulsar (y bloquear el `user_id`) y cerrar la sala.
- Opcional: «sala cerrada» que impide nuevas uniones una vez empezada.

### Número máximo de participantes
- 20 jugadores por sala por defecto (configurable hasta 50). Se comprueba en
  `join-room` dentro de una transacción para evitar carreras.

### Si el anfitrión se desconecta
- Presencia detecta la desconexión. Durante **60 s** de gracia la ronda sigue;
  si el temporizador estaba en marcha, termina normalmente (el servidor es la
  autoridad).
- Pasado el margen, se ofrece el rol de anfitrión al jugador conectado más
  antiguo (o se transfiere automáticamente si la sala lo permite). Si el
  anfitrión original vuelve con su sesión, recupera el control.

## 5. Fases de implementación

1. **Preparación (sin backend):** extraer `GameStore` de `game-ui.ts`, añadir
   `CountdownTimer.syncTo()` y `RoomConfig`. Todo sigue funcionando en local.
2. **Salas «solo pantalla»:** crear/unirse con código y QR, nombres, ronda y
   temporizador sincronizados. Cada uno sigue escribiendo en papel.
3. **Respuestas en el móvil:** envío por jugador, revisión conjunta y votación
   de respuestas dudosas; marcador de la partida.
4. **Ayudas de puntuación:** detección de respuestas repetidas (normalizando
   tildes, como ya hace `categoryKey`), validación de la letra inicial y
   sugerencias; la decisión final sigue siendo del grupo.

## 6. Riesgos y costes

- **Coste:** el plan gratuito de Supabase basta para empezar; vigilar el número
  de conexiones simultáneas de Realtime y mensajes por segundo.
- **Latencia:** el temporizador por `endsAt` hace que la latencia no afecte al
  tiempo restante, solo al momento en que cada uno ve un cambio.
- **Complejidad:** la fase 2 añade unas 4 funciones de servidor y 3 tablas. La
  versión de pantalla compartida no debe depender de ninguna de ellas: si
  Supabase no está disponible, el juego local sigue funcionando.
