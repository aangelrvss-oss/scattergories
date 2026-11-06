/** Identificadores de los packs de categorías disponibles. */
export type PackId = 'clasico' | 'facil' | 'dificil' | 'cultura' | 'divertido' | 'creativo';

export interface CategoryPack {
  id: PackId;
  name: string;
  /** Descripción corta para el selector. */
  description: string;
  categories: readonly string[];
}

/** Cómo se combinan las categorías propias con el pack elegido. */
export type CustomMode = 'mix' | 'only' | 'off';

/** Qué partes del generador se muestran en una página. */
export type GeneratorMode = 'full' | 'letters' | 'categories';

export interface Settings {
  pack: PackId;
  /** Número de categorías por ronda (5–20). */
  categoryCount: number;
  /** Letras habilitadas para el sorteo (en mayúsculas). */
  enabledLetters: string[];
  /** Categorías creadas por el usuario. */
  customCategories: string[];
  customMode: CustomMode;
  /** Categorías de los packs que el usuario ha descartado. */
  hiddenCategories: string[];
  /** Duración del temporizador en segundos. */
  timerSeconds: number;
  /** Arrancar el temporizador automáticamente al empezar una ronda. */
  autoStartTimer: boolean;
  sound: boolean;
}

export interface RoundState {
  /** Número de ronda (0 = todavía no se ha jugado ninguna). */
  round: number;
  letter: string | null;
  categories: string[];
  /** Letras ya sorteadas desde el último reinicio del historial. */
  usedLetters: string[];
}

/** Generador de números aleatorios: devuelve un entero en [0, max). */
export type RandomInt = (max: number) => number;
