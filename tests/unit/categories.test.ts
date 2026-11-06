import { describe, expect, it } from 'vitest';
import { PACKS, getPack, TRADITIONAL_COLUMNS } from '../../src/data/categories';
import {
  buildCategoryPool,
  categoryKey,
  cleanCategoryName,
  dedupeCategories,
  pickCategories,
  replaceCategory,
} from '../../src/utils/categories';
import { MAX_CATEGORIES, MIN_CATEGORIES, createDefaultSettings } from '../../src/utils/settings';
import { seededRandom } from './helpers';

const keys = (list: readonly string[]) => list.map(categoryKey);

describe('base de datos de categorías', () => {
  it('tiene los seis packs y Clásico es el primero', () => {
    expect(PACKS.map((p) => p.id)).toEqual(['clasico', 'facil', 'dificil', 'cultura', 'divertido', 'creativo']);
  });

  it('tiene al menos 120 categorías distintas en total', () => {
    const all = new Set(PACKS.flatMap((p) => keys(p.categories)));
    expect(all.size).toBeGreaterThanOrEqual(120);
  });

  it.each(PACKS.map((p) => [p.name, p] as const))('el pack %s no tiene duplicados y permite listas de 20', (_n, pack) => {
    expect(new Set(keys(pack.categories)).size).toBe(pack.categories.length);
    expect(pack.categories.length).toBeGreaterThanOrEqual(MAX_CATEGORIES * 2);
    pack.categories.forEach((c) => {
      expect(c).toBe(c.trim());
      expect(c.length).toBeGreaterThan(2);
    });
  });

  it('el Clásico incluye las categorías básicas', () => {
    const clasico = keys(getPack('clasico').categories);
    for (const c of ['Animal', 'País', 'Ciudad', 'Comida', 'Fruta', 'Algo que da miedo', 'Algo que llevarías de viaje']) {
      expect(clasico).toContain(categoryKey(c));
    }
  });

  it('las columnas tradicionales no tienen duplicados', () => {
    for (const cols of Object.values(TRADITIONAL_COLUMNS)) {
      expect(new Set(keys(cols)).size).toBe(cols.length);
    }
  });
});

describe('pickCategories', () => {
  const pool = getPack('clasico').categories;

  it.each([MIN_CATEGORIES, 8, 12, MAX_CATEGORIES])('devuelve exactamente %i categorías sin duplicados', (count) => {
    const list = pickCategories(pool, count);
    expect(list).toHaveLength(count);
    expect(new Set(keys(list)).size).toBe(count);
  });

  it('no devuelve más categorías de las que hay', () => {
    expect(pickCategories(['A', 'B', 'C'], 10)).toHaveLength(3);
    expect(pickCategories([], 10)).toEqual([]);
  });

  it('elimina duplicados del pool aunque cambien tildes o mayúsculas', () => {
    const list = pickCategories(['País', 'pais', 'PAÍS', 'Animal'], 5);
    expect(list).toHaveLength(2);
  });

  it('al regenerar evita repetir la lista anterior si hay alternativas', () => {
    const rand = seededRandom(7);
    const first = pickCategories(pool, 12, [], rand);
    const second = pickCategories(pool, 12, first, rand);
    const overlap = second.filter((c) => first.includes(c));
    expect(overlap).toHaveLength(0);
  });

  it('si el pool es pequeño, completa con categorías ya vistas', () => {
    const small = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'];
    const second = pickCategories(small, 5, ['A1', 'B1', 'C1', 'D1', 'E1']);
    expect(second).toHaveLength(5);
    expect(second).toContain('F1');
    expect(second).toContain('G1');
  });
});

describe('packs y categorías propias', () => {
  const base = createDefaultSettings();

  it.each(PACKS.map((p) => [p.id] as const))('el pack %s solo devuelve categorías propias del pack', (id) => {
    const pool = buildCategoryPool({ ...base, pack: id, customCategories: [] });
    const packKeys = new Set(keys(getPack(id).categories));
    pool.forEach((c) => expect(packKeys.has(categoryKey(c))).toBe(true));
    for (let i = 0; i < 20; i++) {
      pickCategories(pool, 20).forEach((c) => expect(packKeys.has(categoryKey(c))).toBe(true));
    }
  });

  it('mezcla las categorías propias con el pack', () => {
    const pool = buildCategoryPool({ ...base, customCategories: ['Villano de Disney'], customMode: 'mix' });
    expect(pool).toContain('Villano de Disney');
    expect(pool.length).toBe(getPack('clasico').categories.length + 1);
  });

  it('modo «solo propias» usa únicamente las del usuario', () => {
    const custom = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis'];
    const pool = buildCategoryPool({ ...base, customCategories: custom, customMode: 'only' });
    expect(pool).toEqual(custom);
    expect(pickCategories(pool, 5).every((c) => custom.includes(c))).toBe(true);
  });

  it('modo «off» ignora las categorías propias', () => {
    const pool = buildCategoryPool({ ...base, customCategories: ['Villano de Disney'], customMode: 'off' });
    expect(pool).not.toContain('Villano de Disney');
  });

  it('las categorías ocultas no salen', () => {
    const hidden = ['Animal', 'país'];
    const pool = buildCategoryPool({ ...base, hiddenCategories: hidden });
    expect(keys(pool)).not.toContain('animal');
    expect(keys(pool)).not.toContain('pais');
  });

  it('una categoría propia igual a una del pack no se duplica', () => {
    const pool = buildCategoryPool({ ...base, customCategories: ['animal'] });
    expect(pool.filter((c) => categoryKey(c) === 'animal')).toHaveLength(1);
  });
});

describe('utilidades de texto', () => {
  it('cleanCategoryName limpia espacios, limita longitud y capitaliza', () => {
    expect(cleanCategoryName('   algo   que  vuela ')).toBe('Algo que vuela');
    expect(cleanCategoryName('   ')).toBe('');
    expect(cleanCategoryName('x'.repeat(100))).toHaveLength(60);
    expect(cleanCategoryName('ñandú')).toBe('Ñandú');
  });

  it('categoryKey ignora tildes pero distingue la ñ', () => {
    expect(categoryKey('Canción')).toBe(categoryKey('cancion'));
    expect(categoryKey('Año')).not.toBe(categoryKey('Ano'));
  });

  it('dedupeCategories conserva el primero', () => {
    expect(dedupeCategories(['Árbol', 'arbol', 'Río'])).toEqual(['Árbol', 'Río']);
  });

  it('replaceCategory cambia solo la categoría indicada', () => {
    const current = ['Animal', 'País', 'Ciudad'];
    const pool = ['Animal', 'País', 'Ciudad', 'Fruta', 'Color'];
    const next = replaceCategory(current, 1, pool);
    expect(next[0]).toBe('Animal');
    expect(next[2]).toBe('Ciudad');
    expect(['Fruta', 'Color']).toContain(next[1]);
  });

  it('replaceCategory quita la categoría si no hay alternativas', () => {
    expect(replaceCategory(['A', 'B'], 0, ['A', 'B'])).toEqual(['B']);
    expect(replaceCategory(['A', 'B'], 5, ['A', 'B', 'C'])).toEqual(['A', 'B']);
  });
});
