import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountdownTimer, describeTime, formatTime } from '../../src/utils/timer';

describe('CountdownTimer', () => {
  let now = 0;
  const clock = () => now;
  const advance = (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('empieza parado con la duración completa', () => {
    const t = new CountdownTimer({ durationMs: 60_000, now: clock });
    expect(t.status).toBe('idle');
    expect(t.remainingMs).toBe(60_000);
  });

  it('arranca y cuenta hacia atrás', () => {
    const t = new CountdownTimer({ durationMs: 60_000, now: clock });
    t.start();
    expect(t.status).toBe('running');
    advance(10_000);
    expect(t.remainingMs).toBe(50_000);
  });

  it('pausa y reanuda sin perder tiempo', () => {
    const t = new CountdownTimer({ durationMs: 60_000, now: clock });
    t.start();
    advance(15_000);
    t.pause();
    expect(t.status).toBe('paused');
    advance(30_000);
    expect(t.remainingMs).toBe(45_000);
    t.resume();
    expect(t.status).toBe('running');
    advance(5_000);
    expect(t.remainingMs).toBe(40_000);
  });

  it('toggle alterna entre en marcha y pausa', () => {
    const t = new CountdownTimer({ durationMs: 60_000, now: clock });
    t.toggle();
    expect(t.status).toBe('running');
    t.toggle();
    expect(t.status).toBe('paused');
    t.toggle();
    expect(t.status).toBe('running');
  });

  it('reset detiene la cuenta y no sigue corriendo', () => {
    const onFinish = vi.fn();
    const t = new CountdownTimer({ durationMs: 5_000, now: clock, onFinish });
    t.start();
    advance(2_000);
    t.reset();
    expect(t.status).toBe('idle');
    expect(t.remainingMs).toBe(5_000);
    advance(10_000);
    expect(onFinish).not.toHaveBeenCalled();
    expect(t.status).toBe('idle');
  });

  it('reset puede cambiar la duración', () => {
    const t = new CountdownTimer({ durationMs: 60_000, now: clock });
    t.reset(90_000);
    expect(t.duration).toBe(90_000);
    expect(t.remainingMs).toBe(90_000);
  });

  it('avisa al llegar a cero una sola vez', () => {
    const onFinish = vi.fn();
    const ticks: string[] = [];
    const t = new CountdownTimer({ durationMs: 3_000, now: clock, onFinish, onTick: (_ms, s) => ticks.push(s) });
    t.start();
    advance(3_500);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(t.status).toBe('finished');
    expect(t.remainingMs).toBe(0);
    advance(5_000);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(ticks.at(-1)).toBe('finished');
  });

  it('tras terminar, start vuelve a empezar desde el principio', () => {
    const t = new CountdownTimer({ durationMs: 1_000, now: clock });
    t.start();
    advance(1_500);
    t.start();
    expect(t.status).toBe('running');
    expect(t.remainingMs).toBe(1_000);
  });

  it('el tiempo es exacto aunque los intervalos se retrasen', () => {
    const t = new CountdownTimer({ durationMs: 60_000, now: clock });
    t.start();
    now += 20_000; // el reloj avanza sin que se disparen intervalos (pestaña en segundo plano)
    expect(t.remainingMs).toBe(40_000);
  });
});

describe('formato', () => {
  it('formatTime', () => {
    expect(formatTime(120_000)).toBe('2:00');
    expect(formatTime(90_000)).toBe('1:30');
    expect(formatTime(9_001)).toBe('0:10');
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });

  it('describeTime', () => {
    expect(describeTime(90_000)).toBe('1 minuto y 30 segundos');
    expect(describeTime(120_000)).toBe('2 minutos');
    expect(describeTime(1_000)).toBe('1 segundo');
    expect(describeTime(0)).toBe('0 segundos');
  });
});
