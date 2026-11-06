/** Alfabeto español completo (27 letras), incluida la Ñ. */
export const SPANISH_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
  'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
] as const;

export type SpanishLetter = (typeof SPANISH_ALPHABET)[number];

/** Letras con muy pocas palabras en español: excluidas por defecto. */
export const DIFFICULT_LETTERS: readonly string[] = ['K', 'Q', 'W', 'X', 'Y', 'Z'];

/** Alfabeto por defecto: A B C D E F G H I J L M N Ñ O P R S T U V */
export const DEFAULT_LETTERS: readonly string[] = SPANISH_ALPHABET.filter(
  (letter) => !DIFFICULT_LETTERS.includes(letter),
);

export function isSpanishLetter(value: string): value is SpanishLetter {
  return (SPANISH_ALPHABET as readonly string[]).includes(value);
}
