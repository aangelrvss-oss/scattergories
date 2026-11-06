/**
 * Acceso seguro a localStorage: si no está disponible (modo privado,
 * cookies bloqueadas, cuota llena…) la app sigue funcionando en memoria.
 */
export interface SafeStorage {
  read<T>(key: string, sanitize: (raw: unknown) => T): T;
  write(key: string, value: unknown): boolean;
  remove(key: string): void;
  readonly persistent: boolean;
}

function detectLocalStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = '__letralista_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function createSafeStorage(backend: Storage | null = detectLocalStorage()): SafeStorage {
  const memory = new Map<string, string>();

  const getRaw = (key: string): string | null => {
    if (backend) {
      try {
        return backend.getItem(key);
      } catch {
        /* sigue con la memoria */
      }
    }
    return memory.get(key) ?? null;
  };

  return {
    persistent: backend !== null,
    read(key, sanitize) {
      const raw = getRaw(key);
      if (raw === null) return sanitize(undefined);
      try {
        return sanitize(JSON.parse(raw));
      } catch {
        return sanitize(undefined);
      }
    },
    write(key, value) {
      const json = JSON.stringify(value);
      memory.set(key, json);
      if (!backend) return false;
      try {
        backend.setItem(key, json);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        backend?.removeItem(key);
      } catch {
        /* nada que hacer */
      }
    },
  };
}
