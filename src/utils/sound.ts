/**
 * Pitidos generados con Web Audio: sin archivos de audio que descargar.
 * El contexto se crea en un gesto del usuario para que funcione en iOS.
 */
type AudioCtor = typeof AudioContext;

let context: AudioContext | null = null;

function getAudioCtor(): AudioCtor | undefined {
  const w = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** Llamar desde un clic: crea o reactiva el contexto de audio. */
export function unlockAudio(): void {
  const Ctor = getAudioCtor();
  if (!Ctor) return;
  try {
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null;
  }
}

function beep(ctx: AudioContext, start: number, frequency: number, length: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** Alarma de fin de tiempo: tres pitidos. */
export function playAlarm(): void {
  unlockAudio();
  if (!context) return;
  const t = context.currentTime + 0.05;
  beep(context, t, 880, 0.18);
  beep(context, t + 0.25, 880, 0.18);
  beep(context, t + 0.5, 1175, 0.45);
}

/** Pitido corto para los últimos segundos. */
export function playTick(): void {
  if (!context || context.state !== 'running') return;
  beep(context, context.currentTime + 0.01, 660, 0.08);
}
