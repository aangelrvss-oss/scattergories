import { describe, expect, it } from 'vitest';
import { pickOne, sample, secureRandomInt, shuffle } from '../../src/utils/random';

describe('secureRandomInt', () => {
  it('devuelve enteros dentro del rango', () => {
    for (let i = 0; i < 2000; i++) {
      const n = secureRandomInt(7);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });

  it('cubre todos los valores con una distribución razonable', () => {
    const counts = new Array(21).fill(0);
    const draws = 21_000;
    for (let i = 0; i < draws; i++) counts[secureRandomInt(21)]++;
    for (const c of counts) {
      // Esperado: 1000 por valor. Margen amplio para evitar falsos positivos.
      expect(c).toBeGreaterThan(800);
      expect(c).toBeLessThan(1200);
    }
  });

  it('rechaza rangos inválidos', () => {
    expect(() => secureRandomInt(0)).toThrow(RangeError);
    expect(() => secureRandomInt(1.5)).toThrow(RangeError);
  });

  it('no produce siempre la misma secuencia', () => {
    const a = Array.from({ length: 20 }, () => secureRandomInt(1000)).join(',');
    const b = Array.from({ length: 20 }, () => secureRandomInt(1000)).join(',');
    expect(a).not.toBe(b);
  });
});

describe('shuffle / sample / pickOne', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('shuffle conserva los elementos y no muta el original', () => {
    const copy = items.slice();
    const result = shuffle(items);
    expect(result.slice().sort()).toEqual(copy);
    expect(items).toEqual(copy);
  });

  it('sample devuelve elementos distintos y el tamaño pedido', () => {
    const result = sample(items, 4);
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(4);
    result.forEach((x) => expect(items).toContain(x));
  });

  it('sample no devuelve más de los disponibles', () => {
    expect(sample(items, 50)).toHaveLength(items.length);
    expect(sample(items, -1)).toHaveLength(0);
  });

  it('pickOne falla con lista vacía', () => {
    expect(() => pickOne([])).toThrow();
    expect(items).toContain(pickOne(items));
  });
});
