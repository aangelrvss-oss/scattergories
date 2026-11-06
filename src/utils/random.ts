import type { RandomInt } from '../types/game';

const UINT32_RANGE = 0x1_0000_0000;

function getCrypto(): Crypto | undefined {
  return typeof globalThis.crypto?.getRandomValues === 'function' ? globalThis.crypto : undefined;
}

/**
 * Entero aleatorio uniforme en [0, max) usando crypto.getRandomValues()
 * con muestreo por rechazo para evitar el sesgo del módulo.
 */
export const secureRandomInt: RandomInt = (max) => {
  if (!Number.isInteger(max) || max <= 0 || max > UINT32_RANGE) {
    throw new RangeError(`max debe ser un entero entre 1 y 2^32 (recibido: ${max})`);
  }
  const cryptoApi = getCrypto();
  if (!cryptoApi) {
    // Entornos muy antiguos sin Web Crypto: degradamos a Math.random.
    return Math.floor(Math.random() * max);
  }
  // Mayor múltiplo de `max` que cabe en 32 bits: por encima, rechazamos.
  const limit = UINT32_RANGE - (UINT32_RANGE % max);
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    cryptoApi.getRandomValues(buffer);
    value = buffer[0]!;
  } while (value >= limit);
  return value % max;
};

/** Elige un elemento al azar. Lanza un error si la lista está vacía. */
export function pickOne<T>(items: readonly T[], rand: RandomInt = secureRandomInt): T {
  if (items.length === 0) throw new Error('No se puede elegir de una lista vacía');
  return items[rand(items.length)]!;
}

/** Devuelve una copia barajada (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], rand: RandomInt = secureRandomInt): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Toma `count` elementos distintos al azar (o todos, si no hay suficientes). */
export function sample<T>(items: readonly T[], count: number, rand: RandomInt = secureRandomInt): T[] {
  const n = Math.max(0, Math.min(count, items.length));
  // Fisher–Yates parcial: solo barajamos las primeras n posiciones.
  const copy = items.slice();
  for (let i = 0; i < n; i++) {
    const j = i + rand(copy.length - i);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}
