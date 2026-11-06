/**
 * Controlador de la interfaz del generador. Conecta el DOM con el motor
 * de juego (src/utils/*), que no sabe nada de la interfaz.
 */
import { DIFFICULT_LETTERS, DEFAULT_LETTERS } from '../data/letters/alphabet';
import { SPANISH_ALPHABET } from '../data/letters/alphabet';
import { getPack } from '../data/categories';
import type { GeneratorMode, RoundState, Settings } from '../types/game';
import { categoryKey, cleanCategoryName, pickCategories } from '../utils/categories';
import { copyText, formatRoundText } from '../utils/clipboard';
import { getFullscreenElement, isFullscreenSupported, toggleFullscreen } from '../utils/fullscreen';
import {
  getPool,
  getRoundPhase,
  type RoundPhase,
  rerollCategories,
  rerollLetter,
  resetGame,
  resetLetterHistory,
  startNewRound,
  swapCategory,
} from '../utils/game';
import { getAvailableLetters, normalizeLetters } from '../utils/letters';
import {
  MAX_CATEGORIES,
  MAX_CUSTOM_CATEGORIES,
  MAX_TIMER_SECONDS,
  MIN_CATEGORIES,
  MIN_TIMER_SECONDS,
  TIMER_PRESETS,
  clampInt,
  createDefaultSettings,
  sanitizeRound,
  sanitizeSettings,
} from '../utils/settings';
import { playAlarm, playTick, unlockAudio } from '../utils/sound';
import { createSafeStorage } from '../utils/storage';
import { CountdownTimer, describeTime, formatTime, type TimerStatus } from '../utils/timer';
import { keepScreenAwake } from '../utils/wakelock';

const SETTINGS_KEY = 'letralista:settings:v1';
const ROUND_KEY = 'letralista:round:v1';

const ICON_SWAP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 7h12l-3-3M17 17H5l3 3"/></svg>';
const ICON_RESTORE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';

const PHASE_LABELS: Record<RoundPhase, string> = {
  empty: '',
  ready: 'Preparados',
  playing: '¡A escribir!',
  paused: 'En pausa',
  stop: '¡Stop! Comparad respuestas',
};

const NARROW_QUERY = '(max-width: 45.99rem)';
/** Tamaño mínimo (px) de las categorías en modo presentación. */
const MIN_PRESENT_FONT = 13;

interface Preset {
  label: string;
  categories: string[];
}

export function initGame(root: HTMLElement): void {
  const mode = (root.dataset.mode as GeneratorMode) ?? 'full';
  const showLetter = mode !== 'categories';
  const showCategories = mode !== 'letters';
  const preset = parsePreset(root.dataset.preset);

  const storage = createSafeStorage();
  let settings: Settings = storage.read(SETTINGS_KEY, sanitizeSettings);
  let state: RoundState = storage.read(ROUND_KEY, sanitizeRound);

  const el = <T extends HTMLElement = HTMLElement>(name: string) =>
    root.querySelector<T>(`[data-el="${name}"]`);
  const action = <T extends HTMLElement = HTMLButtonElement>(name: string) =>
    root.querySelector<T>(`[data-action="${name}"]`);

  const dom = {
    roundLabel: el('round-label'),
    phase: el('phase'),
    presentLabel: el('present-label'),
    timeMini: el('time-mini'),
    timerActionMini: el('timer-action-mini'),
    catsBox: el('cats-box'),
    stopOverlay: el('stop-overlay'),
    resetGame: el('reset-game'),
    resetGameLabel: el('reset-game-label'),
    durationSelect: el<HTMLSelectElement>('duration-select'),
    packName: el('pack-name'),
    tile: el('tile'),
    letter: el('letter'),
    used: el('used'),
    remaining: el('remaining'),
    cats: el('cats'),
    catsEmpty: el('cats-empty'),
    count: el('count'),
    copyLabel: el('copy-label'),
    timer: el('timer'),
    time: el('time'),
    timerFill: el('timer-fill'),
    timerAction: el('timer-action'),
    timerAnnouncer: el('timer-announcer'),
    customTime: el<HTMLFormElement>('custom-time'),
    toast: el('toast'),
    dialog: el<HTMLDialogElement>('settings'),
    form: el<HTMLFormElement>('settings-form'),
    countOutput: el('count-output'),
    lettersCount: el('letters-count'),
    customInput: el<HTMLInputElement>('custom-input'),
    customList: el('custom-list'),
    hiddenList: el('hidden-list'),
    hiddenSummary: el('hidden-summary'),
  };

  // ---------------------------------------------------------------- utilidades

  const saveSettings = () => storage.write(SETTINGS_KEY, settings);
  const saveState = () => storage.write(ROUND_KEY, state);

  let toastTimeout: ReturnType<typeof setTimeout> | undefined;
  function toast(message: string): void {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => dom.toast?.classList.remove('is-visible'), 2600);
  }

  function restartAnimation(node: HTMLElement | null, className: string): void {
    if (!node) return;
    node.classList.remove(className);
    void node.offsetWidth; // fuerza el reinicio de la animación CSS
    node.classList.add(className);
  }

  function checkPool(): void {
    const pool = getPool(settings);
    if (pool.length === 0) {
      toast('No hay categorías disponibles: añade alguna en Ajustes o cambia de modo.');
    } else if (pool.length < settings.categoryCount) {
      toast(`Solo hay ${pool.length} categorías disponibles con estos ajustes.`);
    }
  }

  // ------------------------------------------------------------------ render

  function renderStatus(): void {
    if (dom.roundLabel) dom.roundLabel.textContent = state.round > 0 ? `Ronda ${state.round}` : 'Preparado para jugar';
    if (dom.packName) {
      dom.packName.textContent = settings.customMode === 'only' ? 'Mis categorías' : getPack(settings.pack).name;
    }
    updatePhase();
  }

  /** Fase visible de la ronda: preparados, a escribir, en pausa o stop. */
  function updatePhase(): void {
    const phase = getRoundPhase(state, timer.status);
    if (root.dataset.phase === phase) return;
    root.dataset.phase = phase;
    if (dom.phase) dom.phase.textContent = PHASE_LABELS[phase];
    // Al empezar o terminar la cuenta atrás cambian los controles visibles.
    scheduleFit();
  }

  function renderLetter(animate = false): void {
    if (!showLetter || !dom.letter || !dom.tile) return;
    dom.letter.textContent = state.letter ?? '?';
    dom.tile.classList.toggle('is-empty', !state.letter);
    if (animate) restartAnimation(dom.tile, 'is-new');
    renderUsed();
  }

  function renderUsed(): void {
    if (!dom.used || !dom.remaining) return;
    const left = getAvailableLetters(settings.enabledLetters, state.usedLetters).length;
    const total = settings.enabledLetters.length;
    dom.remaining.textContent =
      state.usedLetters.length === 0
        ? `${total} letras en juego`
        : `Quedan ${left} de ${total} ${total === 1 ? 'letra' : 'letras'}`;
    dom.used.replaceChildren(
      ...state.usedLetters.map((letter) => {
        const li = document.createElement('li');
        li.textContent = letter;
        if (letter === state.letter) li.setAttribute('aria-current', 'true');
        return li;
      }),
    );
  }

  function renderCategories(animate = false, focus?: { index: number; kind: 'swap' | 'discard' }): void {
    if (!showCategories || !dom.cats) return;
    const items = state.categories.map((name, index) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'cats__name';
      label.textContent = name;
      const tools = document.createElement('span');
      tools.className = 'cats__tools';
      tools.append(
        iconButton(ICON_SWAP, `Cambiar «${name}» por otra categoría`, 'Cambiar', { swap: String(index) }),
        iconButton(ICON_CLOSE, `Descartar «${name}» y no volver a mostrarla`, 'Descartar', {
          discard: String(index),
        }),
      );
      li.append(label, tools);
      return li;
    });
    dom.cats.replaceChildren(...items);
    dom.cats.hidden = items.length === 0;
    if (dom.catsEmpty) dom.catsEmpty.hidden = items.length > 0;
    if (animate) restartAnimation(dom.cats, 'is-new');
    scheduleFit();
    if (focus) {
      const target =
        dom.cats.querySelector<HTMLButtonElement>(`[data-${focus.kind}="${focus.index}"]`) ??
        dom.cats.querySelector<HTMLButtonElement>(`[data-${focus.kind}="${focus.index - 1}"]`);
      target?.focus();
    }
  }

  /** Número que muestra el selector: el de la lista actual, si la hay. */
  function shownCount(): number {
    return state.categories.length > 0 ? state.categories.length : settings.categoryCount;
  }

  function renderCount(): void {
    const shown = shownCount();
    if (dom.count) dom.count.textContent = String(shown);
    if (dom.countOutput) dom.countOutput.textContent = String(settings.categoryCount);
    const down = action('count-down');
    const up = action('count-up');
    if (down) down.disabled = shown <= MIN_CATEGORIES;
    if (up) up.disabled = shown >= MAX_CATEGORIES;
  }

  function renderSound(): void {
    const btn = action('sound');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(settings.sound));
    btn.title = settings.sound ? 'Sonido (activado)' : 'Sonido (desactivado)';
  }

  function renderAll(): void {
    renderStatus();
    renderLetter();
    renderCategories();
    renderCount();
    renderSound();
    renderDurationChips();
    updatePhase();
  }

  function iconButton(svg: string, label: string, title: string, data: Record<string, string>): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-btn';
    button.innerHTML = svg;
    button.setAttribute('aria-label', label);
    button.title = title;
    for (const [key, value] of Object.entries(data)) button.dataset[key] = value;
    return button;
  }

  // ---------------------------------------------------------------- acciones

  function afterNewRound(): void {
    timer.reset(settings.timerSeconds * 1000);
    hideStopOverlay();
    if (settings.autoStartTimer) {
      unlockAudio();
      timer.start();
    }
  }

  function newRound(): void {
    if (mode === 'full') {
      const update = startNewRound(state, settings);
      state = update.state;
      if (update.recycled) toast('¡Ya han salido todas las letras! Empieza un nuevo ciclo.');
    } else if (mode === 'letters') {
      const update = rerollLetter(state, settings);
      state = { ...update.state, round: state.round + 1 };
      if (update.recycled) toast('¡Ya han salido todas las letras! Empieza un nuevo ciclo.');
    } else {
      state = { ...rerollCategories(state, settings), round: state.round + 1 };
    }
    if (showCategories) checkPool();
    saveState();
    renderStatus();
    renderLetter(true);
    renderCategories(true);
    afterNewRound();
    revealGame();
  }

  /**
   * En móvil, tras pulsar el botón (fijo abajo) la ronda nueva podría quedar
   * fuera de la vista: subimos hasta el juego para que se vea la letra.
   */
  function revealGame(): void {
    if (present || !window.matchMedia(NARROW_QUERY).matches) return;
    const top = root.getBoundingClientRect().top;
    if (top >= 0 && top < 24) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  function newLetter(): void {
    const update = rerollLetter(state, settings);
    state = update.state;
    if (update.recycled) toast('¡Ya han salido todas las letras! Empieza un nuevo ciclo.');
    saveState();
    renderStatus();
    renderLetter(true);
  }

  function newCategories(): void {
    state = rerollCategories(state, settings);
    checkPool();
    saveState();
    renderStatus();
    renderCategories(true);
  }

  function changeCount(delta: number): void {
    setCount(shownCount() + delta);
  }

  function setCount(value: number): void {
    const next = clampInt(value, MIN_CATEGORIES, MAX_CATEGORIES, settings.categoryCount);
    if (next === settings.categoryCount && next === shownCount()) return renderCount();
    settings = { ...settings, categoryCount: next };
    saveSettings();
    // Ajusta la lista actual sin rehacerla entera.
    if (state.categories.length > 0) {
      if (state.categories.length > next) {
        state = { ...state, categories: state.categories.slice(0, next) };
      } else if (state.categories.length < next) {
        const extra = pickCategories(
          getPool(settings).filter((c) => !state.categories.some((x) => categoryKey(x) === categoryKey(c))),
          next - state.categories.length,
        );
        if (extra.length < next - state.categories.length) checkPool();
        state = { ...state, categories: [...state.categories, ...extra] };
      }
      saveState();
      renderCategories();
    }
    renderCount();
  }

  function swapAt(index: number): void {
    const before = state.categories.length;
    state = swapCategory(state, index, settings);
    if (state.categories.length < before) toast('No quedan más categorías distintas en este pack.');
    saveState();
    renderCategories(false, { index, kind: 'swap' });
  }

  function discardAt(index: number): void {
    const name = state.categories[index];
    if (!name) return;
    const key = categoryKey(name);
    const isCustom = settings.customCategories.some((c) => categoryKey(c) === key);
    settings = isCustom
      ? { ...settings, customCategories: settings.customCategories.filter((c) => categoryKey(c) !== key) }
      : { ...settings, hiddenCategories: [...settings.hiddenCategories, name] };
    saveSettings();
    state = swapCategory(state, index, settings);
    saveState();
    renderCategories(false, { index, kind: 'discard' });
    renderSettingsLists();
    toast(isCustom ? `«${name}» eliminada de tus categorías.` : `«${name}» no volverá a salir. Puedes recuperarla en Ajustes.`);
  }

  async function copyRound(): Promise<void> {
    const categories = showCategories ? state.categories : [];
    const letter = showLetter ? state.letter : null;
    if (!letter && categories.length === 0) {
      toast('Primero genera una ronda.');
      return;
    }
    const ok = await copyText(formatRoundText(letter, categories, state.round));
    if (ok) {
      toast(showCategories ? 'Categorías copiadas al portapapeles.' : 'Letras copiadas al portapapeles.');
      if (dom.copyLabel) {
        dom.copyLabel.textContent = '¡Copiado!';
        setTimeout(() => dom.copyLabel && (dom.copyLabel.textContent = 'Copiar'), 1600);
      }
    } else {
      toast('No se ha podido copiar. Selecciona el texto manualmente.');
    }
  }

  function printSheet(): void {
    if (state.categories.length === 0) {
      toast('Primero genera una lista de categorías.');
      return;
    }
    window.print();
  }

  function loadPreset(): void {
    if (!preset) return;
    // Solo cambia la lista de esta ronda: el número de categorías elegido en
    // los ajustes se mantiene para las rondas siguientes.
    state = { ...state, categories: preset.categories.slice(0, MAX_CATEGORIES), round: Math.max(state.round, 1) };
    saveState();
    renderStatus();
    renderCount();
    renderCategories(true);
    toast('Columnas clásicas cargadas.');
  }

  function resetLetters(): void {
    state = resetLetterHistory(state);
    saveState();
    renderUsed();
    toast('Historial de letras reiniciado: todas pueden volver a salir.');
  }

  let resetConfirmTimeout: ReturnType<typeof setTimeout> | undefined;

  /** «Nueva partida» borra el historial: pide una segunda pulsación. */
  function requestReset(): void {
    if (dom.resetGame?.hasAttribute('data-confirm')) {
      cancelResetConfirm();
      resetAll();
      return;
    }
    dom.resetGame?.setAttribute('data-confirm', '');
    if (dom.resetGameLabel) dom.resetGameLabel.textContent = '¿Seguro? Pulsa otra vez';
    clearTimeout(resetConfirmTimeout);
    resetConfirmTimeout = setTimeout(cancelResetConfirm, 4000);
  }

  function cancelResetConfirm(): void {
    clearTimeout(resetConfirmTimeout);
    dom.resetGame?.removeAttribute('data-confirm');
    if (dom.resetGameLabel) dom.resetGameLabel.textContent = 'Nueva partida';
  }

  function resetAll(): void {
    state = resetGame();
    saveState();
    timer.reset(settings.timerSeconds * 1000);
    hideStopOverlay();
    renderAll();
    toast('Partida nueva: historial de letras y rondas a cero.');
  }

  // -------------------------------------------------------- modo presentación

  const fsSupported = isFullscreenSupported();
  const presentButton = action('present');
  let present = false;

  /** Aplica (o quita) el diseño para pantalla compartida. */
  function setPresent(on: boolean): void {
    if (present === on) return;
    present = on;
    root.classList.toggle('is-present', on);
    if (!on && root.classList.contains('is-focus')) {
      root.classList.remove('is-focus');
      document.documentElement.style.overflow = '';
    }
    if (dom.presentLabel) dom.presentLabel.textContent = on ? 'Salir' : 'Presentar';
    if (presentButton) presentButton.title = on ? 'Salir del modo presentación (F)' : 'Modo presentación (F)';
    keepScreenAwake(on);
    if (!on) hideStopOverlay();
    scheduleFit();
  }

  async function togglePresent(): Promise<void> {
    if (present) {
      if (getFullscreenElement()) {
        try {
          await toggleFullscreen(root);
        } catch {
          setPresent(false);
        }
      } else {
        setPresent(false);
      }
      return;
    }
    if (fsSupported) {
      try {
        await toggleFullscreen(root);
        return; // `fullscreenchange` activa el modo presentación
      } catch {
        /* bloqueado por el navegador: usamos una capa a pantalla completa */
      }
    }
    root.classList.add('is-focus');
    document.documentElement.style.overflow = 'hidden';
    setPresent(true);
  }

  const onFullscreenChange = () => setPresent(getFullscreenElement() === root);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // ---- Ajuste automático del tamaño de las categorías en pantalla compartida

  let fitFrame = 0;
  function scheduleFit(): void {
    if (!present) return;
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fitCategories);
  }

  /**
   * Busca el mayor tamaño de letra (y el número de columnas) con el que
   * todas las categorías caben en su caja sin cortarse ni pasar de dos líneas.
   */
  function fitCategories(): void {
    const list = dom.cats;
    const box = dom.catsBox;
    if (!present || !list || !box || state.categories.length === 0) return;
    box.classList.remove('is-scrollable');
    const width = box.clientWidth;
    const height = box.clientHeight;
    if (width === 0 || height === 0) return;

    const names = [...list.querySelectorAll<HTMLElement>('.cats__name')];
    const fits = (): boolean => {
      if (list.scrollHeight > height + 1 || list.scrollWidth > width + 1) return false;
      const fontPx = parseFloat(getComputedStyle(list).fontSize);
      const maxNameHeight = fontPx * 1.2 * 2 + 2; // máximo dos líneas
      return names.every((n) => n.scrollWidth <= n.clientWidth + 1 && n.offsetHeight <= maxNameHeight);
    };

    let best = { font: 0, cols: 1 };
    const maxCols = Math.min(3, state.categories.length);
    for (let cols = 1; cols <= maxCols; cols++) {
      list.style.setProperty('--cats-cols', String(cols));
      let lo = 8;
      let hi = 160;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        list.style.setProperty('--cats-font', `${mid}px`);
        if (fits()) lo = mid;
        else hi = mid;
      }
      // Preferimos menos columnas salvo que más columnas den letra claramente mayor.
      if (lo > best.font * 1.08) best = { font: lo, cols };
    }
    // Nunca por debajo de un tamaño legible: si no caben (p. ej. 20 categorías
    // en un móvil muy pequeño), la lista se desplaza dentro de su caja.
    const tooSmall = best.font < MIN_PRESENT_FONT;
    box.classList.toggle('is-scrollable', tooSmall);
    if (tooSmall) box.setAttribute('tabindex', '0');
    else box.removeAttribute('tabindex');
    list.style.setProperty('--cats-cols', String(tooSmall ? 1 : best.cols));
    list.style.setProperty('--cats-font', `${Math.floor(Math.max(best.font, MIN_PRESENT_FONT))}px`);
  }

  if (typeof ResizeObserver === 'function' && dom.catsBox) {
    new ResizeObserver(() => scheduleFit()).observe(dom.catsBox);
  }
  window.addEventListener('resize', scheduleFit);
  void document.fonts?.ready.then(scheduleFit);

  // ---- Aviso grande de «¡STOP!» al terminar el tiempo

  let overlayTimeout: ReturnType<typeof setTimeout> | undefined;
  function showStopOverlay(): void {
    if (!present || !dom.stopOverlay) return;
    dom.stopOverlay.classList.add('is-visible');
    clearTimeout(overlayTimeout);
    overlayTimeout = setTimeout(hideStopOverlay, 3500);
  }

  function hideStopOverlay(): void {
    clearTimeout(overlayTimeout);
    dom.stopOverlay?.classList.remove('is-visible');
  }

  dom.stopOverlay?.addEventListener('click', hideStopOverlay);

  // -------------------------------------------------------------- temporizador

  let lastAnnounced = -1;
  let lastTickSecond = -1;

  const TIMER_LABELS: Record<TimerStatus, string> = {
    idle: 'Empezar',
    running: 'Pausar',
    paused: 'Reanudar',
    finished: 'Otra vez',
  };

  function announce(text: string): void {
    if (dom.timerAnnouncer) dom.timerAnnouncer.textContent = text;
  }

  function renderTimer(remainingMs: number, status: TimerStatus): void {
    const text = formatTime(remainingMs);
    const low = status === 'running' && remainingMs <= 10_000;
    if (dom.time) dom.time.textContent = text;
    if (dom.timeMini) dom.timeMini.textContent = text;
    if (dom.timerActionMini) dom.timerActionMini.textContent = TIMER_LABELS[status];
    if (dom.timer) {
      dom.timer.dataset.status = status;
      dom.timer.classList.toggle('is-low', low);
    }
    root.classList.toggle('is-low', low);
    updatePhase();
    if (dom.timerFill) {
      const ratio = timer.duration > 0 ? remainingMs / timer.duration : 0;
      dom.timerFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    }
    if (dom.timerAction) dom.timerAction.textContent = TIMER_LABELS[status];

    if (status === 'running') {
      const seconds = Math.ceil(remainingMs / 1000);
      // Avisos para lectores de pantalla en momentos clave, no cada segundo.
      if ((seconds === 60 || seconds === 30 || seconds === 10) && lastAnnounced !== seconds) {
        lastAnnounced = seconds;
        announce(`Quedan ${describeTime(seconds * 1000)}`);
      }
      if (settings.sound && seconds <= 5 && seconds >= 1 && seconds !== lastTickSecond) {
        lastTickSecond = seconds;
        playTick();
      }
    }
  }

  const timer = new CountdownTimer({
    durationMs: settings.timerSeconds * 1000,
    onTick: (ms, status) => renderTimer(ms, status),
    onFinish: () => {
      updatePhase();
      showStopOverlay();
      announce('¡Tiempo! ¡Stop!');
      if (!present) toast('¡Tiempo! ¡Stop!');
      if (settings.sound) playAlarm();
      try {
        navigator.vibrate?.([220, 120, 220]);
      } catch {
        /* sin vibración */
      }
    },
  });

  function toggleTimer(): void {
    unlockAudio();
    const before = timer.status;
    if (before === 'finished' || before === 'idle') {
      // Si se cambió la duración durante la cuenta anterior, se aplica ahora.
      if (timer.duration !== settings.timerSeconds * 1000) timer.reset(settings.timerSeconds * 1000);
      hideStopOverlay();
      lastAnnounced = -1;
      lastTickSecond = -1;
    }
    timer.toggle();
    if (timer.status === 'running') {
      announce(
        before === 'paused'
          ? `Reanudado. Quedan ${describeTime(timer.remainingMs)}`
          : `Cuenta atrás de ${describeTime(timer.remainingMs)} en marcha`,
      );
    } else if (timer.status === 'paused') {
      announce(`En pausa. Quedan ${describeTime(timer.remainingMs)}`);
    }
  }

  function resetTimer(): void {
    timer.reset(settings.timerSeconds * 1000);
    hideStopOverlay();
    lastAnnounced = -1;
    lastTickSecond = -1;
    announce(`Temporizador reiniciado: ${describeTime(timer.duration)}`);
  }

  function setDuration(seconds: number): void {
    const value = clampInt(seconds, MIN_TIMER_SECONDS, MAX_TIMER_SECONDS, settings.timerSeconds);
    settings = { ...settings, timerSeconds: value };
    saveSettings();
    renderDurationChips();
    if (timer.status === 'running' || timer.status === 'paused') {
      // No interrumpimos una cuenta atrás en marcha por un toque accidental.
      toast(`Duración ${formatTime(value * 1000)}: se aplicará en la próxima cuenta atrás.`);
      return;
    }
    timer.reset(value * 1000);
    hideStopOverlay();
    announce(`Duración: ${describeTime(value * 1000)}`);
  }

  function renderDurationChips(): void {
    const isPreset = (TIMER_PRESETS as readonly number[]).includes(settings.timerSeconds);
    root.querySelectorAll<HTMLButtonElement>('[data-duration]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(Number(chip.dataset.duration) === settings.timerSeconds));
    });
    const custom = action('custom-time');
    if (custom) {
      const text = isPreset ? 'Otro' : formatTime(settings.timerSeconds * 1000);
      custom.textContent = text;
      custom.toggleAttribute('data-active', !isPreset);
      // El nombre accesible empieza por el texto visible (WCAG 2.5.3).
      if (isPreset) custom.removeAttribute('aria-label');
      else custom.setAttribute('aria-label', `${text} (duración personalizada)`);
    }
    renderDurationSelect();
    if (dom.customTime) {
      const min = dom.customTime.elements.namedItem('min') as HTMLInputElement | null;
      const sec = dom.customTime.elements.namedItem('sec') as HTMLInputElement | null;
      if (min) min.value = String(Math.floor(settings.timerSeconds / 60));
      if (sec) sec.value = String(settings.timerSeconds % 60);
    }
  }

  function renderDurationSelect(): void {
    const select = dom.durationSelect;
    if (!select) return;
    const value = String(settings.timerSeconds);
    select.querySelector('option[data-custom]')?.remove();
    if (![...select.options].some((o) => o.value === value)) {
      const option = new Option(`${formatTime(settings.timerSeconds * 1000)} (personalizada)`, value);
      option.dataset.custom = '';
      select.add(option);
    }
    select.value = value;
  }

  dom.customTime?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(dom.customTime!);
    const total = clampInt(data.get('min'), 0, 60, 0) * 60 + clampInt(data.get('sec'), 0, 59, 0);
    if (total < MIN_TIMER_SECONDS) {
      toast(`El mínimo son ${MIN_TIMER_SECONDS} segundos.`);
    }
    setDuration(total);
    toggleCustomTime(false);
  });

  function toggleCustomTime(force?: boolean): void {
    const btn = action('custom-time');
    if (!dom.customTime || !btn) return;
    const open = force ?? dom.customTime.hidden;
    dom.customTime.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) dom.customTime.querySelector('input')?.focus();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') timer.sync();
  });

  // ------------------------------------------------------------------ ajustes

  function renderSettingsForm(): void {
    const form = dom.form;
    if (!form) return;
    form.querySelectorAll<HTMLInputElement>('input[name="pack"]').forEach((input) => {
      input.checked = input.value === settings.pack;
    });
    const range = form.querySelector<HTMLInputElement>('input[name="categoryCount"]');
    if (range) range.value = String(settings.categoryCount);
    renderLetterControls();
    form.querySelectorAll<HTMLInputElement>('input[name="customMode"]').forEach((input) => {
      input.checked = input.value === settings.customMode;
    });
    const auto = form.querySelector<HTMLInputElement>('input[name="autoStartTimer"]');
    if (auto) auto.checked = settings.autoStartTimer;
    const sound = form.querySelector<HTMLInputElement>('input[name="sound"]');
    if (sound) sound.checked = settings.sound;
    renderCount();
    renderSettingsLists();
  }

  function renderLetterControls(): void {
    const form = dom.form;
    if (!form) return;
    const enabled = new Set(settings.enabledLetters);
    form.querySelectorAll<HTMLInputElement>('input[name="letters"]').forEach((input) => {
      input.checked = enabled.has(input.value);
    });
    const difficult = form.querySelector<HTMLInputElement>('input[name="difficult"]');
    if (difficult) {
      const count = DIFFICULT_LETTERS.filter((l) => enabled.has(l)).length;
      difficult.checked = count === DIFFICULT_LETTERS.length;
      difficult.indeterminate = count > 0 && count < DIFFICULT_LETTERS.length;
    }
    if (dom.lettersCount) {
      dom.lettersCount.textContent = `${settings.enabledLetters.length} de ${SPANISH_ALPHABET.length} letras activas`;
    }
  }

  function renderSettingsLists(): void {
    if (dom.customList) {
      dom.customList.replaceChildren(
        ...settings.customCategories.map((name, index) => {
          const li = document.createElement('li');
          li.append(name, iconButton(ICON_CLOSE, `Eliminar «${name}»`, 'Eliminar', { removeCustom: String(index) }));
          return li;
        }),
      );
    }
    if (dom.hiddenList) {
      dom.hiddenList.replaceChildren(
        ...settings.hiddenCategories.map((name, index) => {
          const li = document.createElement('li');
          li.append(
            name,
            iconButton(ICON_RESTORE, `Recuperar «${name}»`, 'Recuperar', { restoreHidden: String(index) }),
          );
          return li;
        }),
      );
    }
    if (dom.hiddenSummary) {
      const n = settings.hiddenCategories.length;
      dom.hiddenSummary.textContent =
        n === 0
          ? 'No has descartado ninguna categoría.'
          : `Has descartado ${n} ${n === 1 ? 'categoría' : 'categorías'}. Pulsa una para recuperarla.`;
    }
    const restoreAll = action('hidden-restore');
    if (restoreAll) restoreAll.hidden = settings.hiddenCategories.length === 0;
  }

  function setLetters(letters: string[]): void {
    const normalized = normalizeLetters(letters);
    if (normalized.length === 0) {
      toast('Tiene que haber al menos una letra en juego.');
      renderLetterControls();
      return;
    }
    settings = { ...settings, enabledLetters: normalized };
    saveSettings();
    renderLetterControls();
    renderUsed();
  }

  function addCustomCategory(): void {
    const input = dom.customInput;
    if (!input) return;
    const name = cleanCategoryName(input.value);
    if (!name) {
      input.focus();
      return;
    }
    const key = categoryKey(name);
    if (settings.customCategories.some((c) => categoryKey(c) === key)) {
      toast('Esa categoría ya está en tu lista.');
      return;
    }
    if (settings.customCategories.length >= MAX_CUSTOM_CATEGORIES) {
      toast(`Puedes guardar hasta ${MAX_CUSTOM_CATEGORIES} categorías propias.`);
      return;
    }
    settings = {
      ...settings,
      customCategories: [...settings.customCategories, name],
      // Si estaba descartada, deja de estarlo.
      hiddenCategories: settings.hiddenCategories.filter((c) => categoryKey(c) !== key),
    };
    saveSettings();
    input.value = '';
    input.focus();
    renderSettingsLists();
    toast(`«${name}» añadida.`);
  }

  dom.form?.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    switch (target.name) {
      case 'pack':
        settings = { ...settings, pack: getPack(target.value as Settings['pack']).id };
        saveSettings();
        renderStatus();
        if (state.categories.length > 0) {
          newCategories();
          toast(`Pack ${getPack(settings.pack).name}: nuevas categorías.`);
        }
        break;
      case 'customMode':
        settings = { ...settings, customMode: target.value as Settings['customMode'] };
        saveSettings();
        renderStatus();
        if (settings.customMode === 'only' && settings.customCategories.length === 0) {
          toast('Aún no tienes categorías propias: añade alguna arriba.');
        }
        break;
      case 'difficult': {
        const base = settings.enabledLetters.filter((l) => !DIFFICULT_LETTERS.includes(l));
        setLetters(target.checked ? [...base, ...DIFFICULT_LETTERS] : base);
        break;
      }
      case 'letters': {
        const checked = [...dom.form!.querySelectorAll<HTMLInputElement>('input[name="letters"]:checked')].map(
          (i) => i.value,
        );
        setLetters(checked);
        break;
      }
      case 'timerSeconds':
        setDuration(Number((target as unknown as HTMLSelectElement).value));
        break;
      case 'autoStartTimer':
        settings = { ...settings, autoStartTimer: target.checked };
        saveSettings();
        break;
      case 'sound':
        settings = { ...settings, sound: target.checked };
        saveSettings();
        renderSound();
        break;
    }
  });

  dom.form?.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name === 'categoryCount') setCount(Number(target.value));
  });

  dom.customInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // evita que el formulario cierre el diálogo
      addCustomCategory();
    }
  });

  dom.dialog?.addEventListener('click', (event) => {
    // Clic en el fondo (fuera del contenido) cierra el diálogo.
    if (event.target === dom.dialog) dom.dialog?.close();
  });

  function openSettings(): void {
    if (!dom.dialog) return;
    renderSettingsForm();
    dom.dialog.showModal();
  }

  // --------------------------------------------------------- delegación clics

  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target || !root.contains(target)) return;
    const { dataset } = target;

    if (dataset.swap) return swapAt(Number(dataset.swap));
    if (dataset.discard) return discardAt(Number(dataset.discard));
    if (dataset.duration) return setDuration(Number(dataset.duration));
    if (dataset.removeCustom) {
      const index = Number(dataset.removeCustom);
      const name = settings.customCategories[index];
      settings = { ...settings, customCategories: settings.customCategories.filter((_, i) => i !== index) };
      saveSettings();
      renderSettingsLists();
      dom.customInput?.focus();
      if (name) toast(`«${name}» eliminada.`);
      return;
    }
    if (dataset.restoreHidden) {
      const index = Number(dataset.restoreHidden);
      const name = settings.hiddenCategories[index];
      settings = { ...settings, hiddenCategories: settings.hiddenCategories.filter((_, i) => i !== index) };
      saveSettings();
      renderSettingsLists();
      if (name) toast(`«${name}» recuperada.`);
      return;
    }

    switch (dataset.action) {
      case 'new':
        return newRound();
      case 'letter':
        return newLetter();
      case 'categories':
        return newCategories();
      case 'count-up':
        return changeCount(1);
      case 'count-down':
        return changeCount(-1);
      case 'copy':
        return void copyRound();
      case 'print':
        return printSheet();
      case 'preset':
        return loadPreset();
      case 'reset-letters':
        return resetLetters();
      case 'reset-game':
        return requestReset();
      case 'sound':
        settings = { ...settings, sound: !settings.sound };
        saveSettings();
        if (settings.sound) unlockAudio();
        renderSound();
        toast(settings.sound ? 'Sonido activado.' : 'Sonido desactivado.');
        return;
      case 'present':
        return void togglePresent();
      case 'settings':
        return openSettings();
      case 'timer':
        return toggleTimer();
      case 'timer-reset':
        return resetTimer();
      case 'custom-time':
        return toggleCustomTime();
      case 'letters-default':
        return setLetters([...DEFAULT_LETTERS]);
      case 'letters-all':
        return setLetters([...SPANISH_ALPHABET]);
      case 'custom-add':
        return addCustomCategory();
      case 'hidden-restore':
        settings = { ...settings, hiddenCategories: [] };
        saveSettings();
        renderSettingsLists();
        toast('Todas las categorías vuelven a estar disponibles.');
        return;
      case 'settings-reset': {
        const custom = settings.customCategories;
        settings = { ...createDefaultSettings(), customCategories: custom };
        saveSettings();
        timer.reset(settings.timerSeconds * 1000);
        renderSettingsForm();
        renderAll();
        toast('Ajustes restablecidos. Tus categorías propias se conservan.');
        return;
      }
    }
  });

  // ------------------------------------------------------------------- teclado

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (dom.dialog?.open) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    // Los atajos solo actúan con el foco en el juego (o sin foco en ningún
    // control), nunca mientras se navega por enlaces o texto (WCAG 2.1.4).
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement && !root.contains(active)) return;

    if (event.key === 'Escape' && root.classList.contains('is-focus')) {
      setPresent(false);
      return;
    }

    const key = event.key.toLowerCase();
    const handlers: Record<string, () => void> = {
      n: newRound,
      t: toggleTimer,
      f: () => void togglePresent(),
    };
    if (mode === 'full') {
      handlers.l = newLetter;
      handlers.c = newCategories;
    }
    const handler = handlers[key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  });

  // ------------------------------------------- sincronización entre pestañas

  window.addEventListener('storage', (event) => {
    if (event.key === SETTINGS_KEY) {
      settings = storage.read(SETTINGS_KEY, sanitizeSettings);
      if (timer.status === 'idle' && timer.duration !== settings.timerSeconds * 1000) {
        timer.reset(settings.timerSeconds * 1000);
      }
      renderAll();
      if (dom.dialog?.open) renderSettingsForm();
    } else if (event.key === ROUND_KEY) {
      state = storage.read(ROUND_KEY, sanitizeRound);
      renderAll();
    }
  });

  // ------------------------------------------------------------------- inicio

  renderAll();
  renderTimer(timer.remainingMs, timer.status);
  root.dataset.ready = 'true';
}

function parsePreset(raw: string | undefined): Preset | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Preset>;
    if (typeof data.label === 'string' && Array.isArray(data.categories)) {
      return { label: data.label, categories: data.categories.filter((c): c is string => typeof c === 'string') };
    }
  } catch {
    /* preset inválido: se ignora */
  }
  return null;
}
