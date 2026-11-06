export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerOptions {
  durationMs: number;
  onTick?: (remainingMs: number, status: TimerStatus) => void;
  onFinish?: () => void;
  /** Reloj inyectable (útil en tests). */
  now?: () => number;
  /** Frecuencia de refresco en ms. */
  tickMs?: number;
}

/**
 * Cuenta atrás basada en una marca de tiempo final, no en contar ticks:
 * si el navegador ralentiza los intervalos (pestaña en segundo plano,
 * móvil bloqueado) el tiempo restante sigue siendo exacto.
 */
export class CountdownTimer {
  private durationMs: number;
  private remaining: number;
  private endAt = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private state: TimerStatus = 'idle';
  private readonly now: () => number;
  private readonly tickMs: number;
  private readonly onTick?: TimerOptions['onTick'];
  private readonly onFinish?: TimerOptions['onFinish'];

  constructor(options: TimerOptions) {
    this.durationMs = Math.max(0, options.durationMs);
    this.remaining = this.durationMs;
    this.now = options.now ?? (() => Date.now());
    this.tickMs = options.tickMs ?? 200;
    this.onTick = options.onTick;
    this.onFinish = options.onFinish;
  }

  get status(): TimerStatus {
    return this.state;
  }

  get duration(): number {
    return this.durationMs;
  }

  get remainingMs(): number {
    if (this.state === 'running') return Math.max(0, this.endAt - this.now());
    return this.remaining;
  }

  /** Arranca desde el principio (o reanuda si estaba en pausa). */
  start(): void {
    if (this.state === 'running') return;
    if (this.state === 'paused') return this.resume();
    this.remaining = this.durationMs;
    this.run();
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.remaining = Math.max(0, this.endAt - this.now());
    this.clear();
    this.state = 'paused';
    this.emit();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.run();
  }

  /** Inicia, pausa o reanuda según el estado actual. */
  toggle(): void {
    if (this.state === 'running') this.pause();
    else this.start();
  }

  /** Detiene la cuenta y vuelve al inicio, opcionalmente con otra duración. */
  reset(durationMs?: number): void {
    this.clear();
    if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
      this.durationMs = Math.max(0, durationMs);
    }
    this.remaining = this.durationMs;
    this.state = 'idle';
    this.emit();
  }

  /** Recalcula el tiempo (por ejemplo al volver a la pestaña). */
  sync(): void {
    if (this.state === 'running') this.tick();
  }

  destroy(): void {
    this.clear();
  }

  private run(): void {
    if (this.remaining <= 0) {
      this.finish();
      return;
    }
    this.endAt = this.now() + this.remaining;
    this.state = 'running';
    this.clear();
    this.intervalId = setInterval(() => this.tick(), this.tickMs);
    this.emit();
  }

  private tick(): void {
    const left = Math.max(0, this.endAt - this.now());
    if (left <= 0) {
      this.finish();
      return;
    }
    this.onTick?.(left, this.state);
  }

  private finish(): void {
    this.clear();
    this.remaining = 0;
    this.state = 'finished';
    this.emit();
    this.onFinish?.();
  }

  private clear(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private emit(): void {
    this.onTick?.(this.remainingMs, this.state);
  }
}

/** Formatea milisegundos como m:ss redondeando hacia arriba (2:00, 0:09…). */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Texto para lectores de pantalla: «1 minuto y 30 segundos». */
export function describeTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`);
  return parts.join(' y ');
}
