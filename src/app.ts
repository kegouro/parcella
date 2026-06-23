// app.ts — Orquestador de Parcella: cablea UI ↔ core ↔ render.
//
// Disciplina: este módulo es el ÚNICO que conoce a la vez `ui/`, `render/` y
// `core/`. Mantiene una sola fuente de verdad (`state: AppState`), propaga los
// cambios hacia abajo (viewer / vistas) y recibe los eventos hacia arriba.
import type { AppState } from './core/types.js';
import { defaultState } from './core/state.js';
import { createViewer, type Viewer } from './render/index.js';
import {
  createControlPanel,
  createEquationView,
  createTransportBar,
  createTutorial,
  createDerivationMode,
  hasSeenWelcome,
} from './ui/index.js';
import { loadStateFromUrl, syncUrl, copyShareLink } from './services/share.js';
import { downloadDataUrl } from './services/exporter.js';

/** Duración (ms) de un barrido completo a velocidad 1. */
const SWEEP_MS = 2600;
/** Intervalo mínimo (ms) entre recálculos de la integral durante la animación. */
const EQ_THROTTLE_MS = 110;

function el(tag: string, className?: string, text?: string): HTMLDivElement {
  const node = document.createElement(tag) as HTMLDivElement;
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Devuelve un nuevo AppState con `progress[c] = p` en cada variable activa. */
function withPlayhead(state: AppState, p: number): AppState {
  const progress = state.sweep.progress.map((prev, i) =>
    state.sweep.active[i] ? p : prev,
  ) as [number, number, number];
  return { ...state, sweep: { ...state.sweep, progress } };
}

export function bootstrap(root: HTMLElement): void {
  // --- Esqueleto de layout (clases definidas en style.css) ---
  root.className = 'app';
  root.textContent = '';

  const workspace = el('div', 'workspace');
  const panel = el('div', 'panel');

  // Conmutador de modo (Explorar | Derivar) + contenedores de cada modo.
  const modeBar = el('div', 'seg mode-bar');
  modeBar.style.marginBottom = '14px';
  const btnExplore = mkButton('', 'Explorar');
  const btnDerive = mkButton('', 'Derivar');
  btnExplore.classList.add('active');
  modeBar.append(btnExplore, btnDerive);
  const exploreWrap = el('div', 'mode-explore');
  const deriveWrap = el('div', 'mode-derive');
  deriveWrap.hidden = true;
  panel.append(modeBar, exploreWrap, deriveWrap);

  const viewer = el('div', 'viewer');
  const viewerTop = el('div', 'viewer-top');
  const equations = el('div', 'equations');
  const actions = el('div', 'viewer-actions');
  const btnTutorial = mkButton('ghost', '¿Cómo se lee?');
  const btnShare = mkButton('ghost', 'Compartir');
  const btnPng = mkButton('ghost', 'PNG');
  actions.append(btnTutorial, btnShare, btnPng);
  viewerTop.append(equations, actions);

  const viewport = el('div', 'viewport');
  const transport = el('div', 'transport');

  viewer.append(viewerTop, viewport, transport);
  workspace.append(panel, viewer);
  root.append(workspace);

  // --- Estado: desde la URL si existe, si no el por defecto ---
  let state: AppState = loadStateFromUrl() ?? defaultState();
  let playhead = 1; // figura completa al abrir
  let playing = false;
  let rafId: number | null = null;
  let lastFrame = 0;
  let lastEq = 0;

  // --- Componentes ---
  const view: Viewer = createViewer(viewport);
  const equationView = createEquationView(equations);
  const tutorial = createTutorial(document.body);
  const derivation = createDerivationMode(deriveWrap, view);

  createControlPanel(
    exploreWrap,
    {
      onChange(next) {
        // Cambio estructural: figura completa, animación detenida.
        state = next;
        playhead = 1;
        stop();
        renderAll();
        syncUrl(state);
      },
    },
    state,
  );

  const transportBar = createTransportBar(transport, {
    onProgress(p) {
      stop();
      playhead = clamp01(p);
      renderSweep();
      equationView.update(withPlayhead(state, playhead));
      transportBar.update(state, playhead, playing);
    },
    onPlayToggle(next) {
      if (next) play();
      else stop();
    },
    onReset() {
      stop();
      playhead = 0;
      renderSweep();
      equationView.update(withPlayhead(state, playhead));
      transportBar.update(state, playhead, playing);
    },
  });

  // Velocidad: la barra emite un CustomEvent('speedchange') en su raíz.
  let speed = 1;
  transport.addEventListener('speedchange', (e) => {
    const detail = (e as CustomEvent<number>).detail;
    if (typeof detail === 'number' && detail > 0) speed = detail;
  });

  // --- Acciones del visor ---
  btnTutorial.addEventListener('click', () => tutorial.open());
  btnShare.addEventListener('click', async () => {
    const ok = await copyShareLink(state);
    flash(btnShare, ok ? '¡Copiado!' : 'Error', 'Compartir');
  });
  btnPng.addEventListener('click', () => {
    try {
      downloadDataUrl(view.toDataURL(), 'parcella.png');
    } catch {
      flash(btnPng, 'Error', 'PNG');
    }
  });

  // --- Render ---
  function renderAll(): void {
    const s = withPlayhead(state, playhead);
    view.update(s);
    equationView.update(s);
    transportBar.update(state, playhead, playing);
  }
  /** Actualización barata solo del barrido/elemento (durante la animación). */
  function renderSweep(): void {
    const sc = withPlayhead(state, playhead);
    state.sweep.progress = sc.sweep.progress; // mantener sincronizado para la URL
    view.setProgress(playhead);
  }

  // --- Animación del barrido ---
  function play(): void {
    if (playing) return;
    if (playhead >= 1) playhead = 0; // reiniciar si estaba al final
    playing = true;
    lastFrame = performance.now();
    transportBar.update(state, playhead, playing);
    const tick = (now: number): void => {
      if (!playing) return;
      const dt = now - lastFrame;
      lastFrame = now;
      playhead = clamp01(playhead + (dt * speed) / SWEEP_MS);
      renderSweep();
      transportBar.update(state, playhead, playing);
      if (now - lastEq > EQ_THROTTLE_MS) {
        equationView.update(withPlayhead(state, playhead));
        lastEq = now;
      }
      if (playhead >= 1) {
        stop();
        equationView.update(withPlayhead(state, playhead));
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  function stop(): void {
    playing = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // --- Conmutador de modo Explorar / Derivar ---
  function setMode(mode: 'explore' | 'derive'): void {
    const derive = mode === 'derive';
    btnExplore.classList.toggle('active', !derive);
    btnDerive.classList.toggle('active', derive);
    exploreWrap.hidden = derive;
    deriveWrap.hidden = !derive;
    equations.style.display = derive ? 'none' : '';
    transport.style.display = derive ? 'none' : '';
    if (derive) {
      stop();
      derivation.activate();
    } else {
      derivation.deactivate();
      renderAll();
    }
  }
  btnExplore.addEventListener('click', () => setMode('explore'));
  btnDerive.addEventListener('click', () => setMode('derive'));

  // --- Resize ---
  window.addEventListener('resize', () => view.resize());

  // --- Arranque ---
  renderAll();

  // Deep-link opcional: ?mode=derive abre directo la derivación guiada.
  const modeParam = new URLSearchParams(window.location.search).get('mode');
  if (modeParam === 'derive') setMode('derive');

  // Inicio rápido la primera vez que se abre la app (no si se llegó por deep-link).
  if (!hasSeenWelcome() && !modeParam) tutorial.openWelcome();
}

function mkButton(variant: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = variant;
  b.textContent = label;
  return b;
}

function flash(btn: HTMLButtonElement, temp: string, restore: string): void {
  btn.textContent = temp;
  window.setTimeout(() => (btn.textContent = restore), 1200);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
