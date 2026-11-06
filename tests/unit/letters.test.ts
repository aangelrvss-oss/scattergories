import { describe, expect, it } from 'vitest';
import { DEFAULT_LETTERS, DIFFICULT_LETTERS, SPANISH_ALPHABET } from '../../src/data/letters/alphabet';
import { drawLetter, getAvailableLetters, normalizeLetterSequence, normalizeLetters } from '../../src/utils/letters';
import { createDefaultSettings } from '../../src/utils/settings';
import { resetLetterHistory, rerollLetter, startNewRound } from '../../src/utils/game';
import { createInitialRound } from '../../src/utils/settings';
import { seededRandom } from './helpers';

describe('alfabeto', () => {
  it('tiene 27 letras e incluye la Ñ', () => {
    expect(SPANISH_ALPHABET).toHaveLength(27);
    expect(SPANISH_ALPHABET).toContain('Ñ');
    expect(SPANISH_ALPHABET.indexOf('Ñ')).toBe(SPANISH_ALPHABET.indexOf('N') + 1);
  });

  it('el alfabeto por defecto excluye K, Q, W, X, Y y Z', () => {
    expect(DEFAULT_LETTERS.join(' ')).toBe('A B C D E F G H I J L M N Ñ O P R S T U V');
    for (const letter of DIFFICULT_LETTERS) expect(DEFAULT_LETTERS).not.toContain(letter);
  });
});

describe('drawLetter', () => {
  it('solo genera letras permitidas', () => {
    const enabled = ['A', 'M', 'Ñ'];
    for (let i = 0; i < 300; i++) {
      expect(enabled).toContain(drawLetter(enabled, []).letter);
    }
  });

  it('con la configuración por defecto nunca salen letras difíciles', () => {
    const settings = createDefaultSettings();
    let state = createInitialRound();
    for (let i = 0; i < 200; i++) {
      state = rerollLetter(state, settings).state;
      expect(DIFFICULT_LETTERS).not.toContain(state.letter);
    }
  });

  it('no repite letras hasta agotar el alfabeto', () => {
    const enabled = [...DEFAULT_LETTERS];
    let used: string[] = [];
    let current: string | null = null;
    const seen: string[] = [];
    for (let i = 0; i < enabled.length; i++) {
      const draw = drawLetter(enabled, used, current);
      expect(draw.recycled).toBe(false);
      expect(seen).not.toContain(draw.letter);
      seen.push(draw.letter);
      used = draw.usedLetters;
      current = draw.letter;
    }
    expect(seen.slice().sort()).toEqual(enabled.slice().sort());
    expect(getAvailableLetters(enabled, used)).toHaveLength(0);

    // Agotado: el historial vuelve a empezar y no repite la letra actual.
    const next = drawLetter(enabled, used, current);
    expect(next.recycled).toBe(true);
    expect(next.usedLetters).toEqual([next.letter]);
    expect(next.letter).not.toBe(current);
  });

  it('la Ñ puede salir', () => {
    const rand = seededRandom(42);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(drawLetter(['N', 'Ñ'], [], null, rand).letter);
    expect(seen.has('Ñ')).toBe(true);
    expect(drawLetter(['Ñ'], [], null).letter).toBe('Ñ');
  });

  it('conserva en el historial las letras usadas aunque ya no estén activas', () => {
    const draw = drawLetter(['A', 'B'], ['Z', 'A']);
    expect(draw.letter).toBe('B');
    expect(draw.usedLetters).toEqual(['Z', 'A', 'B']);
  });

  it('desactivar y volver a activar una letra no permite repetirla', () => {
    const all = [...DEFAULT_LETTERS];
    let used = ['M'];
    // Se desactiva la M y se sigue jugando.
    const withoutM = all.filter((l) => l !== 'M');
    used = drawLetter(withoutM, used, 'M').usedLetters;
    expect(used).toContain('M');
    // Se vuelve a activar: la M sigue contando como usada.
    for (let i = 0; i < all.length - 2; i++) {
      const draw = drawLetter(all, used);
      expect(draw.letter).not.toBe('M');
      expect(draw.recycled).toBe(false);
      used = draw.usedLetters;
    }
    expect(getAvailableLetters(all, used)).toHaveLength(0);
  });

  it('con una sola letra habilitada siempre sale esa', () => {
    let used: string[] = [];
    for (let i = 0; i < 5; i++) {
      const draw = drawLetter(['M'], used, 'M');
      expect(draw.letter).toBe('M');
      used = draw.usedLetters;
    }
  });

  it('respeta un alfabeto personalizado con letras difíciles', () => {
    const enabled = ['K', 'Q', 'W', 'X', 'Y', 'Z'];
    let used: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < enabled.length; i++) {
      const draw = drawLetter(enabled, used);
      seen.add(draw.letter);
      used = draw.usedLetters;
    }
    expect([...seen].sort()).toEqual(enabled);
  });
});

describe('historial', () => {
  it('se reinicia correctamente', () => {
    const settings = createDefaultSettings();
    let state = createInitialRound();
    for (let i = 0; i < 5; i++) state = startNewRound(state, settings).state;
    expect(state.usedLetters).toHaveLength(5);
    const reset = resetLetterHistory(state);
    expect(reset.usedLetters).toEqual([]);
    expect(reset.letter).toBe(state.letter);
    expect(reset.categories).toEqual(state.categories);
    // Tras reiniciar, la siguiente letra no repite la que está en pantalla.
    const next = rerollLetter(reset, settings).state;
    expect(next.letter).not.toBe(state.letter);
    expect(next.usedLetters).toEqual([next.letter]);
  });
});

describe('normalizeLetters', () => {
  it('normaliza, elimina inválidas y ordena según el alfabeto español', () => {
    expect(normalizeLetters(['ñ', 'a', 'Ñ', 'z', '1', 'ab', 5, ' o '])).toEqual(['A', 'Ñ', 'O', 'Z']);
  });
});

describe('normalizeLetterSequence', () => {
  it('conserva el orden, valida y elimina repetidas', () => {
    expect(normalizeLetterSequence(['o', 'S', 'i', 'ñ', 'S', '?', 3, 'd'])).toEqual(['O', 'S', 'I', 'Ñ', 'D']);
  });
});
