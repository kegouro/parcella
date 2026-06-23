/**
 * transportBar.ts — Barra de transporte: play/pausa, velocidad, scrubbers por variable activa.
 * Emite eventos y refleja estado en update(). La animación real la maneja app.ts.
 */

import katex from 'katex';
import type { AppState } from '../core/types.js';
import { getSystem } from '../core/coords.js';
import { varColor } from '../core/colors.js';

export interface TransportHandlers {
  onVarProgress(varIndex: number, p: number): void;
  onPlayToggle(playing: boolean): void;
  onReset(): void;
}

export function createTransportBar(
  container: HTMLElement,
  handlers: TransportHandlers,
): { update(state: AppState, playing: boolean): void } {
  injectStyles();

  const root = document.createElement('div');
  root.className = 'tp-root';
  container.appendChild(root);

  // ---- Play/Pause ----
  const playBtn = document.createElement('button');
  playBtn.className = 'tp-btn tp-btn--play';
  playBtn.type = 'button';
  playBtn.setAttribute('aria-label', 'Reproducir / Pausar');
  playBtn.innerHTML = `
    <svg class="tp-icon tp-icon--play" viewBox="0 0 16 16" aria-hidden="true">
      <polygon points="3,2 13,8 3,14"/>
    </svg>
    <svg class="tp-icon tp-icon--pause" viewBox="0 0 16 16" aria-hidden="true" style="display:none">
      <rect x="3" y="2" width="3.5" height="12"/>
      <rect x="9.5" y="2" width="3.5" height="12"/>
    </svg>
  `;

  playBtn.addEventListener('click', () => {
    const isPlaying = root.dataset['playing'] === '1';
    handlers.onPlayToggle(!isPlaying);
  });

  // ---- Reset ----
  const resetBtn = document.createElement('button');
  resetBtn.className = 'tp-btn tp-btn--reset';
  resetBtn.type = 'button';
  resetBtn.setAttribute('aria-label', 'Reiniciar barrido');
  resetBtn.innerHTML = `
    <svg class="tp-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2a6 6 0 1 0 5.657 8H11.5a4 4 0 1 1-3.5-6v2l3-3-3-3v2z" />
    </svg>
  `;
  resetBtn.addEventListener('click', () => handlers.onReset());

  // ---- Speed selector ----
  const speedLabel = document.createElement('label');
  speedLabel.className = 'tp-speed-label';
  const speedId = `tp-speed-${Date.now()}`;
  speedLabel.htmlFor = speedId;
  speedLabel.textContent = 'Vel:';

  const speedSelect = document.createElement('select');
  speedSelect.className = 'tp-speed';
  speedSelect.id = speedId;
  speedSelect.setAttribute('aria-label', 'Velocidad de animación');

  const speeds: Array<{ value: string; label: string }> = [
    { value: '0.25', label: '×0.25' },
    { value: '0.5',  label: '×0.5' },
    { value: '1',    label: '×1' },
    { value: '2',    label: '×2' },
    { value: '4',    label: '×4' },
  ];

  for (const s of speeds) {
    const o = document.createElement('option');
    o.value = s.value;
    o.textContent = s.label;
    if (s.value === '1') o.selected = true;
    speedSelect.appendChild(o);
  }

  // Speed is informational for app.ts; emit as custom event on root element
  speedSelect.addEventListener('change', () => {
    const evt = new CustomEvent('speedchange', { detail: parseFloat(speedSelect.value), bubbles: true });
    root.dispatchEvent(evt);
  });

  // ---- Layout groups ----
  const btnGroup = document.createElement('div');
  btnGroup.className = 'tp-btn-group';
  btnGroup.appendChild(resetBtn);
  btnGroup.appendChild(playBtn);

  const speedGroup = document.createElement('div');
  speedGroup.className = 'tp-speed-group';
  speedGroup.appendChild(speedLabel);
  speedGroup.appendChild(speedSelect);

  // Sliders container (rebuilt on each update)
  const slidersContainer = document.createElement('div');
  slidersContainer.className = 'tp-sliders';

  root.appendChild(btnGroup);
  root.appendChild(slidersContainer);
  root.appendChild(speedGroup);

  // Track active slider elements keyed by var index for efficient update
  const sliderElements = new Map<number, HTMLInputElement>();
  const progressTexts = new Map<number, HTMLElement>();

  // ---- Update ----
  function update(state: AppState, playing: boolean): void {
    root.dataset['playing'] = playing ? '1' : '0';

    const playIcon = playBtn.querySelector('.tp-icon--play') as HTMLElement | null;
    const pauseIcon = playBtn.querySelector('.tp-icon--pause') as HTMLElement | null;
    if (playIcon) playIcon.style.display = playing ? 'none' : '';
    if (pauseIcon) pauseIcon.style.display = playing ? '' : 'none';
    playBtn.setAttribute('aria-pressed', String(playing));

    const system = getSystem(state.region.system);

    // Determine which var indices are active
    const activeIndices = ([0, 1, 2] as const).filter(c => state.sweep.active[c]);

    // Check if sliders need to be rebuilt (active set changed)
    const currentKeys = [...sliderElements.keys()].sort().join(',');
    const newKeys = activeIndices.slice().sort((a, b) => a - b).join(',');
    const systemChanged = slidersContainer.dataset['system'] !== state.region.system;

    if (currentKeys !== newKeys || systemChanged) {
      // Rebuild sliders
      slidersContainer.innerHTML = '';
      sliderElements.clear();
      progressTexts.clear();
      slidersContainer.dataset['system'] = state.region.system;

      for (const c of activeIndices) {
        const color = varColor(c);
        const varSpec = system.vars[c];

        const row = document.createElement('div');
        row.className = 'tp-var-row';

        // LaTeX label
        const latexSpan = document.createElement('span');
        latexSpan.className = 'tp-var-latex';
        latexSpan.style.color = color;
        try {
          katex.render(varSpec.latex, latexSpan, { throwOnError: false, displayMode: false });
        } catch {
          latexSpan.textContent = varSpec.label;
        }

        // Range input
        const sliderId = `tp-slider-${c}-${Date.now()}`;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = sliderId;
        slider.className = 'tp-var-slider';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.001';
        slider.value = String(state.sweep.progress[c]);
        slider.style.accentColor = color;
        slider.setAttribute('aria-label', `Progreso de ${varSpec.label}`);

        slider.addEventListener('input', () => {
          handlers.onVarProgress(c, parseFloat(slider.value));
        });

        // Progress text
        const pText = document.createElement('span');
        pText.className = 'tp-var-pct';
        pText.style.color = color;
        pText.textContent = `${(state.sweep.progress[c] * 100).toFixed(0)}%`;

        row.appendChild(latexSpan);
        row.appendChild(slider);
        row.appendChild(pText);
        slidersContainer.appendChild(row);

        sliderElements.set(c, slider);
        progressTexts.set(c, pText);
      }
    } else {
      // Just update values without rebuilding DOM
      for (const c of activeIndices) {
        const slider = sliderElements.get(c);
        const pText = progressTexts.get(c);
        const progress = state.sweep.progress[c];
        if (slider) slider.value = String(Math.min(1, Math.max(0, progress)));
        if (pText) pText.textContent = `${(progress * 100).toFixed(0)}%`;
      }
    }
  }

  return { update };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('tp-styles')) return;
  const style = document.createElement('style');
  style.id = 'tp-styles';
  style.textContent = `
    .tp-root {
      background: #16213e;
      color: #e0e0f0;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 14px;
      border-radius: 6px;
      border: 1px solid #2d2d4a;
      flex-wrap: wrap;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
    }
    .tp-btn-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tp-btn {
      background: #2d2d4a;
      border: 1px solid #3d3d60;
      color: #e0e0f0;
      border-radius: 6px;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .tp-btn:hover {
      background: #3d3d60;
    }
    .tp-btn--play {
      background: #7c5cff;
      border-color: #7c5cff;
    }
    .tp-btn--play:hover {
      background: #6b4de8;
    }
    .tp-icon {
      width: 14px;
      height: 14px;
      fill: #e0e0f0;
    }
    /* Per-variable sliders */
    .tp-sliders {
      display: flex;
      flex-direction: column;
      gap: 5px;
      flex: 1;
      min-width: 160px;
    }
    .tp-var-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tp-var-latex {
      min-width: 22px;
      font-size: 13px;
      text-align: center;
      flex-shrink: 0;
    }
    .tp-var-latex .katex {
      font-size: 1em;
    }
    .tp-var-slider {
      flex: 1;
      cursor: pointer;
      height: 4px;
    }
    .tp-var-pct {
      font-size: 11px;
      font-weight: 600;
      min-width: 32px;
      text-align: right;
      flex-shrink: 0;
    }
    /* Speed group */
    .tp-speed-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tp-speed-label {
      color: #8080a0;
      font-size: 12px;
    }
    .tp-speed {
      background: #0f0f23;
      border: 1px solid #3d3d60;
      color: #e0e0f0;
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .tp-speed:focus {
      outline: none;
      border-color: #7c5cff;
    }
  `;
  document.head.appendChild(style);
}
