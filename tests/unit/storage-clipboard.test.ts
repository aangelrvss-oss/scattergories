import { describe, expect, it, vi } from 'vitest';
import { createSafeStorage } from '../../src/utils/storage';
import { copyText, formatRoundText } from '../../src/utils/clipboard';
import { sanitizeSettings } from '../../src/utils/settings';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('createSafeStorage', () => {
  it('guarda y lee valores saneados', () => {
    const storage = createSafeStorage(new MemoryStorage());
    expect(storage.persistent).toBe(true);
    storage.write('ajustes', { categoryCount: 8 });
    expect(storage.read('ajustes', sanitizeSettings).categoryCount).toBe(8);
  });

  it('funciona en memoria si no hay localStorage', () => {
    const storage = createSafeStorage(null);
    expect(storage.persistent).toBe(false);
    expect(storage.write('k', { categoryCount: 6 })).toBe(false);
    expect(storage.read('k', sanitizeSettings).categoryCount).toBe(6);
  });

  it('sobrevive a un localStorage que lanza errores y a JSON corrupto', () => {
    const broken = new MemoryStorage();
    broken.setItem('k', '{no es json');
    expect(createSafeStorage(broken).read('k', sanitizeSettings).categoryCount).toBe(12);

    const throwing = new MemoryStorage();
    throwing.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    throwing.getItem = () => {
      throw new Error('SecurityError');
    };
    const storage = createSafeStorage(throwing);
    expect(storage.write('k', { categoryCount: 9 })).toBe(false);
    expect(storage.read('k', sanitizeSettings).categoryCount).toBe(9);
  });
});

describe('portapapeles', () => {
  it('formatea la ronda', () => {
    expect(formatRoundText('M', ['Animal', 'País'], 2)).toBe('Ronda 2\nLetra: M\n\n1. Animal\n2. País');
    expect(formatRoundText(null, ['Animal'])).toBe('1. Animal');
  });

  it('usa navigator.clipboard cuando existe', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('hola', {} as Document)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hola');
    vi.unstubAllGlobals();
  });

  it('recurre a execCommand si la API moderna falla', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denegado')) } });
    const textarea = { value: '', style: {}, setAttribute: vi.fn(), select: vi.fn(), remove: vi.fn() };
    const doc = {
      createElement: vi.fn(() => textarea),
      body: { appendChild: vi.fn() },
      execCommand: vi.fn(() => true),
    } as unknown as Document;
    await expect(copyText('hola', doc)).resolves.toBe(true);
    expect(textarea.value).toBe('hola');
    expect(textarea.remove).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
