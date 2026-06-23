/**
 * derivation.ts — Modo Derivación guiado de Parcella.
 *
 * Construye el elemento diferencial arista por arista con un stepper visual.
 * Maneja el visor 3D a través de la interfaz ViewerLike (sin acoplamiento a render/).
 */

import type { AppState, Vec3, Region, SweepState, SystemId } from '../core/types.js';
import { buildLesson, availableLessons } from '../core/derivation.js';
import type { Lesson, DerivStep } from '../core/derivation.js';
import { getSystem } from '../core/coords.js';
import { sampleRegion } from '../core/region.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ---------------------------------------------------------------------------
// Interfaz pública del visor
// ---------------------------------------------------------------------------

export interface ViewerLike {
  update(state: AppState): void;
  setProgress(p: number): void;
  setLabels(labels: { position: Vec3; html: string }[]): void;
}

// ---------------------------------------------------------------------------
// Región didáctica por sistema
// ---------------------------------------------------------------------------

function lessonRegion(systemId: SystemId): Region {
  switch (systemId) {
    case 'spherical':
      return {
        system: 'spherical',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },
          { lower: 0, upper: '2 * pi' },
          { lower: 0, upper: 'pi' },
        ],
      };
    case 'cylindrical':
      return {
        system: 'cylindrical',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },
          { lower: 0, upper: '2 * pi' },
          { lower: 0, upper: 1.5 },
        ],
      };
    case 'polar':
      return {
        system: 'polar',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },
          { lower: 0, upper: '2 * pi' },
          { lower: 0, upper: 0 },
        ],
      };
    default:
      return {
        system: 'cartesian',
        order: [0, 1, 2],
        bounds: [
          { lower: 0, upper: 1 },
          { lower: 0, upper: 1 },
          { lower: 0, upper: 1 },
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Helper DOM
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function renderKatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode });
  } catch {
    return latex;
  }
}

// ---------------------------------------------------------------------------
// Factory principal
// ---------------------------------------------------------------------------

export function createDerivationMode(
  panelContainer: HTMLElement,
  viewer: ViewerLike,
): { activate(): void; deactivate(): void } {
  injectDerivStyles();

  let currentLesson: Lesson = buildLesson('spherical');
  let currentStepIdx = 0;
  let animRaf: number | null = null;

  // ------------------------------------------------------------------ root
  const root = el('div', 'drv-panel');
  root.style.display = 'none';
  panelContainer.appendChild(root);

  // ====================== 1. SELECTOR DE LECCIÓN ======================
  const sysSection = buildSection('Sistema de coordenadas');
  root.appendChild(sysSection.el);

  const segBar = el('div', 'drv-seg');
  sysSection.body.appendChild(segBar);

  const lessons = availableLessons();
  const segBtns: HTMLButtonElement[] = [];

  for (const ls of lessons) {
    const btn = el('button', 'drv-seg-btn');
    btn.textContent = ls.label;
    btn.dataset['sysId'] = ls.id;
    btn.addEventListener('click', () => {
      currentLesson = buildLesson(ls.id);
      currentStepIdx = 0;
      updateSegActive(ls.id);
      renderUI();
      renderStepInViewer(currentLesson.steps[0], 0);
    });
    segBar.appendChild(btn);
    segBtns.push(btn);
  }

  function updateSegActive(sysId: string): void {
    for (const b of segBtns) {
      b.classList.toggle('drv-seg-btn--active', b.dataset['sysId'] === sysId);
    }
  }
  updateSegActive('spherical');

  // ====================== 2. STEPPER / NARRACIÓN ======================
  const stepSection = buildSection('Paso actual');
  root.appendChild(stepSection.el);

  const stepIndicator = el('p', 'drv-step-indicator');
  stepSection.body.appendChild(stepIndicator);

  const stepTitle = el('h4', 'drv-step-title');
  stepSection.body.appendChild(stepTitle);

  const stepNarration = el('p', 'drv-step-narration');
  stepSection.body.appendChild(stepNarration);

  const partialBox = el('div', 'drv-partial-box');
  stepSection.body.appendChild(partialBox);

  // ====================== 3. CONTROLES ======================
  const ctrlRow = el('div', 'drv-ctrl-row');
  root.appendChild(ctrlRow);

  const btnPrev = el('button', 'drv-btn drv-btn--sec');
  btnPrev.textContent = '‹ Anterior';
  ctrlRow.appendChild(btnPrev);

  const btnAnim = el('button', 'drv-btn drv-btn--anim');
  btnAnim.textContent = '▶ Animar';
  ctrlRow.appendChild(btnAnim);

  const btnNext = el('button', 'drv-btn drv-btn--pri');
  btnNext.textContent = 'Siguiente ›';
  ctrlRow.appendChild(btnNext);

  // ====================== 4. RESULTADO FINAL ======================
  const finalSection = buildSection('Elemento diferencial');
  root.appendChild(finalSection.el);

  const finalBox = el('div', 'drv-final-box');
  finalSection.body.appendChild(finalBox);

  // ------------------------------------------------------------------ lógica
  function renderUI(): void {
    const lesson = currentLesson;
    const stepIdx = currentStepIdx;
    const step = lesson.steps[stepIdx];
    const total = lesson.steps.length;

    // Indicador
    stepIndicator.textContent = `Paso ${stepIdx + 1} / ${total}`;

    // Título y narración
    stepTitle.textContent = step.title;
    stepNarration.textContent = step.narration;

    // partialLatex
    partialBox.innerHTML = '';
    if (step.partialLatex) {
      const symbolMap: Record<string, string> = {
        dl: 'dl',
        dS: 'dS',
        dA: 'dA',
        dV: 'dV',
      };
      const sym = symbolMap[step.symbol] ?? '';
      const latex = sym
        ? `${sym} = ${step.partialLatex}`
        : step.partialLatex;
      partialBox.innerHTML = renderKatex(latex, true);
    }

    // Resultado final
    finalBox.innerHTML = '';
    if (stepIdx === total - 1) {
      finalBox.innerHTML = renderKatex(lesson.finalLatex, true);
      finalBox.classList.add('drv-final-box--highlight');
    } else {
      finalBox.innerHTML = renderKatex(lesson.finalLatex, true);
      finalBox.classList.remove('drv-final-box--highlight');
    }

    // Botones
    btnPrev.disabled = stepIdx === 0;
    btnNext.disabled = stepIdx === total - 1;
    btnAnim.disabled = step.sweepVar === null;
  }

  function renderStepInViewer(step: DerivStep, playhead: number): void {
    const region = lessonRegion(currentLesson.system);
    const system = getSystem(currentLesson.system);

    // Construir SweepState
    const active: [boolean, boolean, boolean] = [
      step.activeVars[0],
      step.activeVars[1],
      step.activeVars[2],
    ];

    const progress: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      if (!active[c]) {
        progress[c] = 0;
      } else if (c === step.sweepVar) {
        // Variable que se barre ahora: progresa con playhead
        progress[c] = playhead;
      } else {
        // Variable ya construida en pasos anteriores: completa
        progress[c] = 1;
      }
    }

    const sweep: SweepState = {
      active,
      frozen: [0.5, 0.5, 0.5],
      progress,
    };

    const appState: AppState = {
      region,
      integrand: { mode: 'geometric' },
      sweep,
    };

    viewer.update(appState);
    viewer.setProgress(playhead);

    // Rótulo de longitud de arista
    if (step.lengthLatex && step.sweepVar !== null) {
      // Construir vector t en orden de region.order:
      // - variables activas YA construidas (distintas de sweepVar): t = 1
      // - sweepVar (la que se barre): t = 0.5 (punto medio del arco)
      // - variables no activas (congeladas): t = 0.5
      const tByOrder: [number, number, number] = [0.5, 0.5, 0.5];
      for (let level = 0; level < 3; level++) {
        const varIdx = region.order[level];
        if (active[varIdx] && varIdx !== step.sweepVar) {
          tByOrder[level] = 1;
        } else {
          tByOrder[level] = 0.5;
        }
      }

      const { cartesian } = sampleRegion(region, system, tByOrder);
      const html = renderKatex(step.lengthLatex, false);
      viewer.setLabels([{ position: cartesian, html }]);
    } else {
      viewer.setLabels([]);
    }
  }

  // Animación
  function animateStep(step: DerivStep): void {
    if (animRaf !== null) {
      cancelAnimationFrame(animRaf);
      animRaf = null;
    }
    if (step.sweepVar === null) return;

    const duration = 1800; // ms
    let startTime: number | null = null;

    function frame(ts: number): void {
      if (startTime === null) startTime = ts;
      const elapsed = ts - startTime;
      const playhead = Math.min(elapsed / duration, 1);

      renderStepInViewer(step, playhead);

      if (playhead < 1) {
        animRaf = requestAnimationFrame(frame);
      } else {
        animRaf = null;
        btnAnim.textContent = '▶ Animar';
      }
    }

    btnAnim.textContent = '⏹ Detener';
    animRaf = requestAnimationFrame(frame);
  }

  btnPrev.addEventListener('click', () => {
    stopAnim();
    currentStepIdx = Math.max(0, currentStepIdx - 1);
    renderUI();
    renderStepInViewer(currentLesson.steps[currentStepIdx], 1);
  });

  btnNext.addEventListener('click', () => {
    stopAnim();
    currentStepIdx = Math.min(currentLesson.steps.length - 1, currentStepIdx + 1);
    renderUI();
    renderStepInViewer(currentLesson.steps[currentStepIdx], 1);
  });

  btnAnim.addEventListener('click', () => {
    if (animRaf !== null) {
      stopAnim();
      return;
    }
    const step = currentLesson.steps[currentStepIdx];
    animateStep(step);
  });

  function stopAnim(): void {
    if (animRaf !== null) {
      cancelAnimationFrame(animRaf);
      animRaf = null;
    }
    btnAnim.textContent = '▶ Animar';
  }

  // ------------------------------------------------------------------ API
  return {
    activate() {
      root.style.display = '';
      currentLesson = buildLesson('spherical');
      currentStepIdx = 0;
      updateSegActive('spherical');
      renderUI();
      renderStepInViewer(currentLesson.steps[0], 0);
    },
    deactivate() {
      stopAnim();
      root.style.display = 'none';
      viewer.setLabels([]);
    },
  };
}

// ---------------------------------------------------------------------------
// Section builder (consistente con controlPanel)
// ---------------------------------------------------------------------------

function buildSection(title: string): { el: HTMLElement; body: HTMLElement } {
  const section = document.createElement('section');
  section.className = 'pc-section';
  const h = document.createElement('h3');
  h.className = 'pc-section-title';
  h.textContent = title;
  const body = document.createElement('div');
  body.className = 'pc-section-body';
  section.appendChild(h);
  section.appendChild(body);
  return { el: section, body };
}

// ---------------------------------------------------------------------------
// Estilos propios del panel de derivación
// ---------------------------------------------------------------------------

function injectDerivStyles(): void {
  if (document.getElementById('drv-styles')) return;
  const style = document.createElement('style');
  style.id = 'drv-styles';
  style.textContent = `
    .drv-panel {
      background: #1a1a2e;
      color: #e0e0f0;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      padding: 16px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
    }

    /* Selector segmentado de sistema */
    .drv-seg {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .drv-seg-btn {
      flex: 1;
      background: transparent;
      border: 1px solid #3d3d60;
      color: #a0a0c0;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .drv-seg-btn:hover {
      border-color: #7c5cff;
      color: #e0e0f0;
    }
    .drv-seg-btn--active {
      background: #7c5cff;
      border-color: #7c5cff;
      color: white;
    }

    /* Paso actual */
    .drv-step-indicator {
      color: #7c5cff;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0 0 4px;
    }
    .drv-step-title {
      color: #e0e0f0;
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 6px;
    }
    .drv-step-narration {
      color: #b0b0d0;
      font-size: 13px;
      line-height: 1.5;
      margin: 0 0 10px;
    }

    /* Caja de fórmula parcial */
    .drv-partial-box {
      background: #0f0f23;
      border: 1px solid #3d3d60;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .drv-partial-box .katex {
      font-size: 1.4em;
    }

    /* Controles */
    .drv-ctrl-row {
      display: flex;
      gap: 8px;
      justify-content: center;
    }
    .drv-btn {
      padding: 7px 16px;
      border-radius: 5px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    .drv-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .drv-btn--pri {
      background: #7c5cff;
      color: white;
      border-color: #7c5cff;
    }
    .drv-btn--pri:hover:not(:disabled) {
      background: #9070ff;
      border-color: #9070ff;
    }
    .drv-btn--sec {
      background: transparent;
      color: #a0a0c0;
      border-color: #3d3d60;
    }
    .drv-btn--sec:hover:not(:disabled) {
      border-color: #7c5cff;
      color: #e0e0f0;
    }
    .drv-btn--anim {
      background: #1a1a3a;
      color: #7c5cff;
      border-color: #7c5cff;
    }
    .drv-btn--anim:hover:not(:disabled) {
      background: #2a2a4a;
    }

    /* Resultado final */
    .drv-final-box {
      background: #0f0f23;
      border: 1px solid #3d3d60;
      border-radius: 6px;
      padding: 14px;
      text-align: center;
      transition: border-color 0.25s, box-shadow 0.25s;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .drv-final-box .katex {
      font-size: 1.3em;
    }
    .drv-final-box--highlight {
      border-color: #7c5cff;
      box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.22);
    }
  `;
  document.head.appendChild(style);
}
