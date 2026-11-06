/**
 * Mantiene la pantalla encendida mientras se usa el modo presentación
 * (Screen Wake Lock API). Si el navegador no lo soporta, no hace nada.
 */
type Sentinel = { release: () => Promise<void>; released?: boolean };
type WakeLockApi = { request: (type: 'screen') => Promise<Sentinel> };

let sentinel: Sentinel | null = null;
let wanted = false;

function api(): WakeLockApi | undefined {
  return (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
}

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(api());
}

async function acquire(): Promise<void> {
  const wakeLock = api();
  if (!wanted || !wakeLock || document.visibilityState !== 'visible') return;
  if (sentinel && !sentinel.released) return;
  try {
    sentinel = await wakeLock.request('screen');
  } catch {
    sentinel = null; // denegado (batería baja, política del navegador…)
  }
}

export function keepScreenAwake(on: boolean): void {
  wanted = on;
  if (on) {
    void acquire();
  } else if (sentinel) {
    const current = sentinel;
    sentinel = null;
    void current.release().catch(() => undefined);
  }
}

// El navegador libera el bloqueo al ocultar la pestaña: lo recuperamos al volver.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void acquire();
  });
}
