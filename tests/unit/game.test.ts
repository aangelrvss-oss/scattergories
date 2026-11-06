import { describe, expect, it } from 'vitest';
import { getPack } from '../../src/data/categories';
import {
  rerollCategories,
  rerollLetter,
  resetGame,
  startNewRound,
  swapCategory,
} from '../../src/utils/game';
import { categoryKey } from '../../src/utils/categories';
import {
  DEFAULT_SETTINGS,
  MAX_CATEGORIES,
  MIN_CATEGORIES,
  createDefaultSettings,
  createInitialRound,
  sanitizeRound,
  sanitizeSettings,
} from '../../src/utils/settings';

describe('rondas', () => {
  it('una nueva ronda genera letra y categorías', () => {
    const settings = createDefaultSettings();
    const { state } = startNewRound(createInitialRound(), settings);
    expect(state.round).toBe(1);
    expect(settings.enabledLetters).toContain(state.letter);
    expect(state.categories).toHaveLength(settings.categoryCount);
    expect(state.usedLetters).toEqual([state.letter]);
  });

  it('las rondas consecutivas no repiten letra hasta agotar el alfabeto', () => {
    const settings = createDefaultSettings();
    let state = createInitialRound();
    const letters: string[] = [];
    for (let i = 0; i < settings.enabledLetters.length; i++) {
      state = startNewRound(state, settings).state;
      letters.push(state.letter!);
    }
    expect(new Set(letters).size).toBe(settings.enabledLetters.length);
    expect(state.round).toBe(settings.enabledLetters.length);
    const next = startNewRound(state, settings);
    expect(next.recycled).toBe(true);
  });

  it('regenerar la letra no cambia las categorías', () => {
    const settings = createDefaultSettings();
    const { state } = startNewRound(createInitialRound(), settings);
    const next = rerollLetter(state, settings).state;
    expect(next.categories).toEqual(state.categories);
    expect(next.letter).not.toBe(state.letter);
    expect(next.usedLetters).toHaveLength(2);
    expect(next.round).toBe(state.round);
  });

  it('regenerar las categorías no cambia la letra ni el historial', () => {
    const settings = createDefaultSettings();
    const { state } = startNewRound(createInitialRound(), settings);
    const next = rerollCategories(state, settings);
    expect(next.letter).toBe(state.letter);
    expect(next.usedLetters).toEqual(state.usedLetters);
    expect(next.categories).toHaveLength(settings.categoryCount);
    expect(next.categories).not.toEqual(state.categories);
  });

  it('respeta los ajustes: número de categorías, pack y letras', () => {
    const settings = { ...createDefaultSettings(), categoryCount: 7, pack: 'divertido' as const, enabledLetters: ['Ñ', 'Z'] };
    const { state } = startNewRound(createInitialRound(), settings);
    expect(state.categories).toHaveLength(7);
    const packKeys = getPack('divertido').categories.map(categoryKey);
    state.categories.forEach((c) => expect(packKeys).toContain(categoryKey(c)));
    expect(['Ñ', 'Z']).toContain(state.letter);
  });

  it('swapCategory cambia una sola categoría', () => {
    const settings = createDefaultSettings();
    const { state } = startNewRound(createInitialRound(), settings);
    const next = swapCategory(state, 3, settings);
    expect(next.categories).toHaveLength(state.categories.length);
    next.categories.forEach((c, i) => {
      if (i === 3) expect(c).not.toBe(state.categories[3]);
      else expect(c).toBe(state.categories[i]);
    });
    expect(new Set(next.categories).size).toBe(next.categories.length);
  });

  it('resetGame vuelve al estado inicial', () => {
    expect(resetGame()).toEqual(createInitialRound());
  });
});

describe('ajustes', () => {
  it('valores por defecto', () => {
    expect(DEFAULT_SETTINGS.pack).toBe('clasico');
    expect(DEFAULT_SETTINGS.categoryCount).toBe(12);
    expect(DEFAULT_SETTINGS.enabledLetters).not.toContain('K');
  });

  it('sanitizeSettings corrige valores inválidos', () => {
    const s = sanitizeSettings({
      pack: 'inventado',
      categoryCount: 99,
      enabledLetters: [],
      customCategories: ['  hola ', 'Hola', 3],
      customMode: 'raro',
      timerSeconds: 1,
      autoStartTimer: 'si',
      sound: false,
    });
    expect(s.pack).toBe('clasico');
    expect(s.categoryCount).toBe(MAX_CATEGORIES);
    expect(s.enabledLetters).toEqual(createDefaultSettings().enabledLetters);
    expect(s.customCategories).toEqual(['Hola']);
    expect(s.customMode).toBe('mix');
    expect(s.timerSeconds).toBe(10);
    expect(s.autoStartTimer).toBe(false);
    expect(s.sound).toBe(false);
    expect(sanitizeSettings({ categoryCount: 1 }).categoryCount).toBe(MIN_CATEGORIES);
  });

  it('sanitizeSettings acepta basura sin romperse', () => {
    for (const raw of [null, undefined, 42, 'texto', [], { enabledLetters: 'abc' }]) {
      expect(sanitizeSettings(raw)).toEqual(createDefaultSettings());
    }
  });

  it('sanitizeRound valida el estado guardado', () => {
    expect(sanitizeRound({ round: 3, letter: 'ñ', categories: ['animal'], usedLetters: ['a', 'ñ', '?'] })).toEqual({
      round: 3,
      letter: 'Ñ',
      categories: ['Animal'],
      usedLetters: ['A', 'Ñ'],
    });
    expect(sanitizeRound('nope')).toEqual(createInitialRound());
  });
});
