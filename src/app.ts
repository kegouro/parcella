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
  createCurvilinearTool,
  hasSeenWelcome,
} from './ui/index.js';
import { loadStateFromUrl, syncUrl, copyShareLink } from './services/share.js';
import { downloadDataUrl } from './services/exporter.js';
import { recordSweepGif, downloadGif } from './services/gifRecorder.js';

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

/** Pone `progress[c] = p` en cada variable ACTIVA (mutando el estado).
 *  Se usa para el play y la grabación, que barren todas las activas a la vez. */
function applyUniformProgress(state: AppState, p: number): void {
  for (let c = 0; c < 3; c++) {
    if (state.sweep.active[c]) state.sweep.progress[c] = p;
  }
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
  const btnCurv = mkButton('ghost', 'Curvilíneas');
  const btnShare = mkButton('ghost', 'Compartir');
  const btnPng = mkButton('ghost', 'PNG');
  const btnGif = mkButton('ghost', 'GIF');
  actions.append(btnTutorial, btnCurv, btnShare, btnPng, btnGif);
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
  const curvilinear = createCurvilinearTool(document.body);
  const derivation = createDerivationMode(deriveWrap, view);

  createControlPanel(
    exploreWrap,
    {
      onChange(next) {
        // Cambio estructural: figura completa, animación detenida.
        state = next;
        applyUniformProgress(state, 1);
        playhead = 1;
        stop();
        renderAll();
        syncUrl(state);
      },
    },
    state,
  );

  const transportBar = createTransportBar(transport, {
    // El usuario mueve el slider de UNA variable: progreso independiente por variable.
    onVarProgress(c, p) {
      stop();
      state.sweep.progress[c] = clamp01(p);
      view.update(state);
      equationView.update(state);
      transportBar.update(state, playing);
    },
    onPlayToggle(next) {
      if (next) play();
      else stop();
    },
    onReset() {
      stop();
      applyUniformProgress(state, 0);
      playhead = 0;
      view.update(state);
      equationView.update(state);
      transportBar.update(state, playing);
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
  btnCurv.addEventListener('click', () => curvilinear.open());
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
  btnGif.addEventListener('click', async () => {
    const canvas = viewport.querySelector('canvas');
    if (!canvas) return;
    stop();
    btnGif.textContent = 'Grabando…';
    try {
      const blob = await recordSweepGif({
        canvas,
        onFrame: (t) => renderUniform(clamp01(t)),
      });
      downloadGif(blob, 'parcella.gif');
      flash(btnGif, '¡Listo!', 'GIF');
    } catch {
      flash(btnGif, 'Error', 'GIF');
    } finally {
      playhead = 1;
      renderUniform(1);
      equationView.update(state);
      transportBar.update(state, playing);
    }
  });

  // --- Render ---
  function renderAll(): void {
    view.update(state);
    equationView.update(state);
    transportBar.update(state, playing);
  }
  /** Barato durante el play/grabación: mismo progreso en todas las activas. */
  function renderUniform(p: number): void {
    applyUniformProgress(state, p);
    view.setProgress(p);
  }

  // --- Animación del barrido ---
  function play(): void {
    if (playing) return;
    if (playhead >= 1) playhead = 0; // reiniciar si estaba al final
    playing = true;
    lastFrame = performance.now();
    transportBar.update(state, playing);
    const tick = (now: number): void => {
      if (!playing) return;
      const dt = now - lastFrame;
      lastFrame = now;
      playhead = clamp01(playhead + (dt * speed) / SWEEP_MS);
      renderUniform(playhead);
      transportBar.update(state, playing);
      if (now - lastEq > EQ_THROTTLE_MS) {
        equationView.update(state);
        lastEq = now;
      }
      if (playhead >= 1) {
        stop();
        equationView.update(state);
        transportBar.update(state, playing);
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
  // Observamos el viewport directamente: cuando las ecuaciones (KaTeX) crecen el
  // layout tras renderizar, el alto del visor cambia sin un 'resize' de ventana.
  // Sin esto, el canvas WebGL conserva su tamaño viejo y se desborda sobre la
  // barra de transporte, tapándola.
  window.addEventListener('resize', () => view.resize());
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => view.resize());
    ro.observe(viewport);
  }

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
