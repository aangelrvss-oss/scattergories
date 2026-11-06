import type { RandomInt, RoundState, Settings } from '../types/game';
import type { TimerStatus } from './timer';
import { secureRandomInt } from './random';
import { drawLetter } from './letters';
import { buildCategoryPool, pickCategories, replaceCategory } from './categories';
import { createInitialRound } from './settings';

/**
 * Motor de partida: funciones puras que reciben el estado y devuelven uno
 * nuevo. No tocan el DOM, así que se pueden probar de forma aislada.
 */
export interface GameUpdate {
  state: RoundState;
  /** Se agotaron las letras y el historial se reinició. */
  recycled: boolean;
}

export function getPool(settings: Settings): string[] {
  return buildCategoryPool(settings);
}

/** Nueva ronda: letra sin repetir + lista nueva de categorías. */
export function startNewRound(state: RoundState, settings: Settings, rand: RandomInt = secureRandomInt): GameUpdate {
  const draw = drawLetter(settings.enabledLetters, state.usedLetters, state.letter, rand);
  const categories = pickCategories(getPool(settings), settings.categoryCount, state.categories, rand);
  return {
    state: { round: state.round + 1, letter: draw.letter, categories, usedLetters: draw.usedLetters },
    recycled: draw.recycled,
  };
}

/** Cambia solo la letra; las categorías se mantienen. */
export function rerollLetter(state: RoundState, settings: Settings, rand: RandomInt = secureRandomInt): GameUpdate {
  const draw = drawLetter(settings.enabledLetters, state.usedLetters, state.letter, rand);
  return {
    state: { ...state, round: Math.max(state.round, 1), letter: draw.letter, usedLetters: draw.usedLetters },
    recycled: draw.recycled,
  };
}

/** Cambia solo las categorías; la letra y el historial se mantienen. */
export function rerollCategories(state: RoundState, settings: Settings, rand: RandomInt = secureRandomInt): RoundState {
  return {
    ...state,
    round: Math.max(state.round, 1),
    categories: pickCategories(getPool(settings), settings.categoryCount, state.categories, rand),
  };
}

/** Sustituye una sola categoría de la lista actual. */
export function swapCategory(
  state: RoundState,
  index: number,
  settings: Settings,
  rand: RandomInt = secureRandomInt,
): RoundState {
  return { ...state, categories: replaceCategory(state.categories, index, getPool(settings), rand) };
}

/** Borra el historial de letras usadas sin tocar la ronda actual. */
export function resetLetterHistory(state: RoundState): RoundState {
  return { ...state, usedLetters: [] };
}

/** Reinicia la partida completa. */
export function resetGame(): RoundState {
  return createInitialRound();
}

/**
 * Fase de la ronda, derivada del estado y del temporizador. Es la misma
 * información que mostraría cualquier pantalla (o, en el futuro, cualquier
 * dispositivo conectado a una sala): por eso vive en el motor, no en la UI.
 */
export type RoundPhase = 'empty' | 'ready' | 'playing' | 'paused' | 'stop';

export function getRoundPhase(state: RoundState, timerStatus: TimerStatus): RoundPhase {
  // Sin ronda generada y sin usar el temporizador: pantalla de inicio.
  if (!state.letter && state.categories.length === 0 && timerStatus === 'idle') return 'empty';
  switch (timerStatus) {
    case 'running':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'finished':
      return 'stop';
    default:
      return 'ready';
  }
}
