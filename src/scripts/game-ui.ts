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

const SETTINGS_KEY = 'letralista:settings:v1';
const ROUND_KEY = 'letralista:round:v1';

const ICON_SWAP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 7h12l-3-3M17 17H5l3 3"/></svg>';
const ICON_RESTORE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';

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
    if (focus) {
      const target =
        dom.cats.querySelector<HTMLButtonElement>(`[data-${focus.kind}="${focus.index}"]`) ??
        dom.cats.querySelector<HTMLButtonElement>(`[data-${focus.kind}="${focus.index - 1}"]`);
      target?.focus();
    }
  }

  function renderCount(): void {
    if (dom.count) dom.count.textContent = String(settings.categoryCount);
    if (dom.countOutput) dom.countOutput.textContent = String(settings.categoryCount);
    const down = action('count-down');
    const up = action('count-up');
    if (down) down.disabled = settings.categoryCount <= MIN_CATEGORIES;
    if (up) up.disabled = settings.categoryCount >= MAX_CATEGORIES;
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
    root.classList.remove('is-timeup');
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
    setCount(settings.categoryCount + delta);
  }

  function setCount(value: number): void {
    const next = clampInt(value, MIN_CATEGORIES, MAX_CATEGORIES, settings.categoryCount);
    if (next === settings.categoryCount) return renderCount();
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
    state = { ...state, categories: preset.categories.slice(0, MAX_CATEGORIES), round: Math.max(state.round, 1) };
    settings = {
      ...settings,
      categoryCount: clampInt(state.categories.length, MIN_CATEGORIES, MAX_CATEGORIES, settings.categoryCount),
    };
    saveSettings();
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

  function resetAll(): void {
    state = resetGame();
    saveState();
    timer.reset(settings.timerSeconds * 1000);
    root.classList.remove('is-timeup');
    renderAll();
    toast('Partida reiniciada.');
  }

  // --------------------------------------------------------- pantalla completa

  const fsSupported = isFullscreenSupported();
  const fsButton = action('fullscreen');

  function setFocusMode(on: boolean): void {
    root.classList.toggle('is-focus', on);
    document.documentElement.style.overflow = on ? 'hidden' : '';
    fsButton?.setAttribute('aria-pressed', String(on));
  }

  async function fullscreen(): Promise<void> {
    if (fsSupported) {
      try {
        await toggleFullscreen(root);
        return;
      } catch {
        /* p. ej. bloqueado por el navegador: usamos el modo enfoque */
      }
    }
    setFocusMode(!root.classList.contains('is-focus'));
  }

  document.addEventListener('fullscreenchange', () => {
    fsButton?.setAttribute('aria-pressed', String(getFullscreenElement() === root));
  });
  document.addEventListener('webkitfullscreenchange', () => {
    fsButton?.setAttribute('aria-pressed', String(getFullscreenElement() === root));
  });

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
    if (dom.time) dom.time.textContent = formatTime(remainingMs);
    if (dom.timer) {
      dom.timer.dataset.status = status;
      dom.timer.classList.toggle('is-low', status === 'running' && remainingMs <= 10_000);
    }
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
      root.classList.add('is-timeup');
      announce('¡Tiempo! ¡Stop!');
      toast('¡Tiempo! ¡Stop!');
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
      root.classList.remove('is-timeup');
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
    root.classList.remove('is-timeup');
    lastAnnounced = -1;
    lastTickSecond = -1;
    announce(`Temporizador reiniciado: ${describeTime(timer.duration)}`);
  }

  function setDuration(seconds: number): void {
    const value = clampInt(seconds, MIN_TIMER_SECONDS, MAX_TIMER_SECONDS, settings.timerSeconds);
    settings = { ...settings, timerSeconds: value };
    saveSettings();
    timer.reset(value * 1000);
    root.classList.remove('is-timeup');
    renderDurationChips();
    announce(`Duración: ${describeTime(value * 1000)}`);
  }

  function renderDurationChips(): void {
    const isPreset = (TIMER_PRESETS as readonly number[]).includes(settings.timerSeconds);
    root.querySelectorAll<HTMLButtonElement>('[data-duration]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(Number(chip.dataset.duration) === settings.timerSeconds));
    });
    const custom = action('custom-time');
    if (custom) {
      custom.textContent = isPreset ? 'Otro' : formatTime(settings.timerSeconds * 1000);
      custom.toggleAttribute('data-active', !isPreset);
      custom.setAttribute(
        'aria-label',
        isPreset ? 'Otra duración' : `Duración personalizada: ${describeTime(settings.timerSeconds * 1000)}. Cambiar`,
      );
    }
    if (dom.customTime) {
      const min = dom.customTime.elements.namedItem('min') as HTMLInputElement | null;
      const sec = dom.customTime.elements.namedItem('sec') as HTMLInputElement | null;
      if (min) min.value = String(Math.floor(settings.timerSeconds / 60));
      if (sec) sec.value = String(settings.timerSeconds % 60);
    }
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
        return resetAll();
      case 'sound':
        settings = { ...settings, sound: !settings.sound };
        saveSettings();
        if (settings.sound) unlockAudio();
        renderSound();
        toast(settings.sound ? 'Sonido activado.' : 'Sonido desactivado.');
        return;
      case 'fullscreen':
        return void fullscreen();
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

    if (event.key === 'Escape' && root.classList.contains('is-focus')) {
      setFocusMode(false);
      return;
    }

    const key = event.key.toLowerCase();
    const handlers: Record<string, () => void> = {
      n: newRound,
      t: toggleTimer,
      f: () => void fullscreen(),
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
