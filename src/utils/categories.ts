import { getPack } from '../data/categories';
import type { CustomMode, PackId, RandomInt } from '../types/game';
import { sample, shuffle, secureRandomInt } from './random';

export const MAX_CATEGORY_LENGTH = 60;

/** Clave de comparación: sin tildes, minúsculas y espacios normalizados. */
export function categoryKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-̂̄-ͯ]/g, '') // conserva la virgulilla (ñ ≠ n)
    .normalize('NFC')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Limpia el texto que escribe el usuario. Devuelve '' si no es válido. */
export function cleanCategoryName(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CATEGORY_LENGTH).trim();
  if (!text) return '';
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
}

/** Elimina duplicados (ignorando mayúsculas y tildes), conservando el primero. */
export function dedupeCategories(categories: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const category of categories) {
    const key = categoryKey(category);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(category);
  }
  return result;
}

export interface PoolOptions {
  pack: PackId;
  customCategories: readonly string[];
  customMode: CustomMode;
  hiddenCategories: readonly string[];
}

/** Conjunto de categorías del que se sortea, según el pack y las preferencias. */
export function buildCategoryPool(options: PoolOptions): string[] {
  const hidden = new Set(options.hiddenCategories.map(categoryKey));
  const fromPack =
    options.customMode === 'only'
      ? []
      : getPack(options.pack).categories.filter((c) => !hidden.has(categoryKey(c)));
  const custom = options.customMode === 'off' ? [] : options.customCategories;
  return dedupeCategories([...fromPack, ...custom]);
}

/**
 * Elige `count` categorías distintas. Si el pool lo permite, evita las de
 * `avoid` (por ejemplo, la lista anterior) para que la nueva lista sea fresca.
 */
export function pickCategories(
  pool: readonly string[],
  count: number,
  avoid: readonly string[] = [],
  rand: RandomInt = secureRandomInt,
): string[] {
  const unique = dedupeCategories(pool);
  const wanted = Math.max(0, Math.min(Math.floor(count), unique.length));
  const avoidKeys = new Set(avoid.map(categoryKey));
  const fresh = unique.filter((c) => !avoidKeys.has(categoryKey(c)));

  if (fresh.length >= wanted) return sample(fresh, wanted, rand);

  const repeated = unique.filter((c) => avoidKeys.has(categoryKey(c)));
  return shuffle([...fresh, ...sample(repeated, wanted - fresh.length, rand)], rand);
}

/**
 * Sustituye la categoría en `index` por otra del pool que no esté ya en la
 * lista. Si no quedan alternativas, simplemente la quita.
 */
export function replaceCategory(
  current: readonly string[],
  index: number,
  pool: readonly string[],
  rand: RandomInt = secureRandomInt,
): string[] {
  if (index < 0 || index >= current.length) return current.slice();
  const inList = new Set(current.map(categoryKey));
  const candidates = dedupeCategories(pool).filter((c) => !inList.has(categoryKey(c)));
  const next = current.slice();
  if (candidates.length === 0) {
    next.splice(index, 1);
  } else {
    next[index] = sample(candidates, 1, rand)[0]!;
  }
  return next;
}
