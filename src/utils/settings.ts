import { DEFAULT_LETTERS } from '../data/letters/alphabet';
import { DEFAULT_PACK_ID, isPackId } from '../data/categories';
import type { CustomMode, RoundState, Settings } from '../types/game';
import { normalizeLetterSequence, normalizeLetters } from './letters';
import { cleanCategoryName, dedupeCategories } from './categories';

export const MIN_CATEGORIES = 5;
export const MAX_CATEGORIES = 20;
export const DEFAULT_CATEGORY_COUNT = 12;
export const TIMER_PRESETS = [60, 90, 120, 180] as const;
export const DEFAULT_TIMER_SECONDS = 120;
export const MIN_TIMER_SECONDS = 10;
export const MAX_TIMER_SECONDS = 60 * 60;
export const MAX_CUSTOM_CATEGORIES = 200;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  pack: DEFAULT_PACK_ID,
  categoryCount: DEFAULT_CATEGORY_COUNT,
  enabledLetters: [...DEFAULT_LETTERS],
  customCategories: [],
  customMode: 'mix',
  hiddenCategories: [],
  timerSeconds: DEFAULT_TIMER_SECONDS,
  autoStartTimer: false,
  sound: true,
});

export function createDefaultSettings(): Settings {
  return {
    ...DEFAULT_SETTINGS,
    enabledLetters: [...DEFAULT_SETTINGS.enabledLetters],
    customCategories: [],
    hiddenCategories: [],
  };
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

const CUSTOM_MODES: readonly CustomMode[] = ['mix', 'only', 'off'];

/** Convierte cualquier valor (p. ej. lo leído de localStorage) en ajustes válidos. */
export function sanitizeSettings(raw: unknown): Settings {
  const base = createDefaultSettings();
  if (!isObject(raw)) return base;

  const letters = normalizeLetters(stringList(raw.enabledLetters));
  const custom = dedupeCategories(stringList(raw.customCategories).map(cleanCategoryName)).slice(
    0,
    MAX_CUSTOM_CATEGORIES,
  );

  return {
    pack: isPackId(raw.pack) ? raw.pack : base.pack,
    categoryCount: clampInt(raw.categoryCount, MIN_CATEGORIES, MAX_CATEGORIES, base.categoryCount),
    enabledLetters: letters.length > 0 ? letters : base.enabledLetters,
    customCategories: custom,
    customMode: CUSTOM_MODES.includes(raw.customMode as CustomMode) ? (raw.customMode as CustomMode) : base.customMode,
    hiddenCategories: dedupeCategories(stringList(raw.hiddenCategories)),
    timerSeconds: clampInt(raw.timerSeconds, MIN_TIMER_SECONDS, MAX_TIMER_SECONDS, base.timerSeconds),
    autoStartTimer: typeof raw.autoStartTimer === 'boolean' ? raw.autoStartTimer : base.autoStartTimer,
    sound: typeof raw.sound === 'boolean' ? raw.sound : base.sound,
  };
}

export function createInitialRound(): RoundState {
  return { round: 0, letter: null, categories: [], usedLetters: [] };
}

/** Valida el estado de la ronda guardado. */
export function sanitizeRound(raw: unknown): RoundState {
  const base = createInitialRound();
  if (!isObject(raw)) return base;
  const [letter] = normalizeLetters([raw.letter]);
  return {
    round: clampInt(raw.round, 0, 1_000_000, 0),
    letter: letter ?? null,
    categories: dedupeCategories(stringList(raw.categories).map(cleanCategoryName)).slice(0, MAX_CATEGORIES),
    usedLetters: normalizeLetterSequence(stringList(raw.usedLetters)),
  };
}
