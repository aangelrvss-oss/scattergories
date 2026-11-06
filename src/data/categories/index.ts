import type { CategoryPack, PackId } from '../../types/game';
import { clasico } from './clasico';
import { facil } from './facil';
import { dificil } from './dificil';
import { cultura } from './cultura';
import { divertido } from './divertido';
import { creativo } from './creativo';

/**
 * Registro de packs. Para añadir un pack nuevo: crea un archivo con un
 * `CategoryPack`, impórtalo aquí y añade su id al tipo `PackId`.
 */
export const PACKS: readonly CategoryPack[] = [clasico, facil, dificil, cultura, divertido, creativo];

export const DEFAULT_PACK_ID: PackId = 'clasico';

export const PACK_IDS: readonly PackId[] = PACKS.map((pack) => pack.id);

export function isPackId(value: unknown): value is PackId {
  return typeof value === 'string' && (PACK_IDS as readonly string[]).includes(value);
}

export function getPack(id: PackId): CategoryPack {
  return PACKS.find((pack) => pack.id === id) ?? clasico;
}

/** Columnas tradicionales de cada variante, para cargar la hoja de siempre. */
export const TRADITIONAL_COLUMNS = {
  stop: ['Nombre', 'Apellido', 'Ciudad', 'País', 'Animal', 'Cosa', 'Color', 'Fruta o verdura', 'Comida', 'Marca'],
  tuttiFrutti: [
    'Nombre',
    'Apellido',
    'Animal',
    'Color',
    'Fruta o verdura',
    'País, ciudad o provincia',
    'Cosa',
    'Comida',
    'Marca',
    'Profesión',
  ],
  basta: ['Nombre', 'Apellido', 'Ciudad, estado o país', 'Animal', 'Flor o fruto', 'Color', 'Cosa', 'Artista'],
} as const satisfies Record<string, readonly string[]>;
