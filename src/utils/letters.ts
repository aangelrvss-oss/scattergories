import { SPANISH_ALPHABET, DEFAULT_LETTERS, isSpanishLetter } from '../data/letters/alphabet';
import type { RandomInt } from '../types/game';
import { pickOne, secureRandomInt } from './random';

export interface LetterDraw {
  letter: string;
  /** Historial actualizado (incluye la letra sorteada). */
  usedLetters: string[];
  /** true si se agotaron las letras y el historial empezó de nuevo. */
  recycled: boolean;
}

/** Normaliza una lista de letras: mayúsculas, válidas, sin repetir y en orden alfabético. */
export function normalizeLetters(letters: readonly unknown[]): string[] {
  const wanted = new Set(
    letters.filter((l): l is string => typeof l === 'string').map((l) => l.trim().toLocaleUpperCase('es')),
  );
  return SPANISH_ALPHABET.filter((letter) => wanted.has(letter));
}

/**
 * Valida una secuencia de letras conservando su orden (p. ej. el historial
 * de letras sorteadas): mayúsculas, solo letras válidas y sin repetir.
 */
export function normalizeLetterSequence(letters: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of letters) {
    if (typeof raw !== 'string') continue;
    const letter = raw.trim().toLocaleUpperCase('es');
    if (!isSpanishLetter(letter) || seen.has(letter)) continue;
    seen.add(letter);
    result.push(letter);
  }
  return result;
}

/** Letras que todavía no han salido. */
export function getAvailableLetters(enabled: readonly string[], used: readonly string[]): string[] {
  const usedSet = new Set(used);
  return enabled.filter((letter) => !usedSet.has(letter));
}

/**
 * Sortea una letra sin repetir hasta agotar el alfabeto habilitado.
 * Cuando se agotan las letras activas, el historial se reinicia
 * automáticamente. Nunca se
 * repite seguida la letra actual (`avoid`) si hay alternativas.
 */
export function drawLetter(
  enabledLetters: readonly string[],
  usedLetters: readonly string[],
  avoid: string | null = null,
  rand: RandomInt = secureRandomInt,
): LetterDraw {
  const enabled = enabledLetters.length > 0 ? normalizeLetters(enabledLetters) : [...DEFAULT_LETTERS];
  const pool = enabled.length > 0 ? enabled : [...DEFAULT_LETTERS];
  // El historial se conserva completo aunque cambien las letras activas:
  // así, desactivar y volver a activar una letra no permite que se repita.
  let used = normalizeLetterSequence(usedLetters);
  let available = getAvailableLetters(pool, used);
  let recycled = false;

  if (available.length === 0) {
    recycled = true;
    used = [];
    available = pool.slice();
  }

  // Nunca repetimos la letra que está en pantalla si hay alternativas.
  if (avoid && available.length > 1) available = available.filter((l) => l !== avoid);

  const letter = pickOne(available, rand);
  return { letter, usedLetters: [...used, letter], recycled };
}
