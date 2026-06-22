/**
 * transportBar.ts — Barra de transporte: play/pausa, velocidad, scrubber de progreso.
 * Emite eventos y refleja estado en update(). La animación real la maneja app.ts.
 */

import type { AppState } from '../core/types.js';

export interface TransportHandlers {
  onProgress(p: number): void;
  onPlayToggle(playing: boolean): void;
  onReset(): void;
}

export function createTransportBar(
  container: HTMLElement,
  handlers: TransportHandlers,
): { update(state: AppState, progress: number, playing: boolean): void } {
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

  // ---- Scrubber ----
  const scrubLabel = document.createElement('label');
  scrubLabel.className = 'tp-scrub-label';
  const scrubId = `tp-scrub-${Date.now()}`;
  scrubLabel.htmlFor = scrubId;
  scrubLabel.textContent = 'Progreso:';

  const scrubber = document.createElement('input');
  scrubber.className = 'tp-scrubber';
  scrubber.type = 'range';
  scrubber.id = scrubId;
  scrubber.min = '0';
  scrubber.max = '1';
  scrubber.step = '0.001';
  scrubber.value = '0';
  scrubber.setAttribute('aria-label', 'Progreso del barrido 0 a 1');

  scrubber.addEventListener('input', () => {
    handlers.onProgress(parseFloat(scrubber.value));
  });

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

  // ---- Progress label ----
  const progressText = document.createElement('span');
  progressText.className = 'tp-progress-text';
  progressText.textContent = '0%';

  // ---- Layout ----
  const btnGroup = document.createElement('div');
  btnGroup.className = 'tp-btn-group';
  btnGroup.appendChild(resetBtn);
  btnGroup.appendChild(playBtn);

  const scrubGroup = document.createElement('div');
  scrubGroup.className = 'tp-scrub-group';
  scrubGroup.appendChild(scrubLabel);
  scrubGroup.appendChild(scrubber);
  scrubGroup.appendChild(progressText);

  const speedGroup = document.createElement('div');
  speedGroup.className = 'tp-speed-group';
  speedGroup.appendChild(speedLabel);
  speedGroup.appendChild(speedSelect);

  root.appendChild(btnGroup);
  root.appendChild(scrubGroup);
  root.appendChild(speedGroup);

  // ---- Update ----
  function update(_state: AppState, progress: number, playing: boolean): void {
    root.dataset['playing'] = playing ? '1' : '0';

    const playIcon = playBtn.querySelector('.tp-icon--play') as HTMLElement | null;
    const pauseIcon = playBtn.querySelector('.tp-icon--pause') as HTMLElement | null;
    if (playIcon) playIcon.style.display = playing ? 'none' : '';
    if (pauseIcon) pauseIcon.style.display = playing ? '' : 'none';

    scrubber.value = String(Math.min(1, Math.max(0, progress)));
    progressText.textContent = `${(progress * 100).toFixed(0)}%`;

    playBtn.setAttribute('aria-pressed', String(playing));
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
    .tp-scrub-group {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 120px;
    }
    .tp-scrub-label {
      color: #8080a0;
      font-size: 12px;
      white-space: nowrap;
    }
    .tp-scrubber {
      flex: 1;
      accent-color: #7c5cff;
      cursor: pointer;
      height: 4px;
    }
    .tp-progress-text {
      color: #7c5cff;
      font-size: 12px;
      font-weight: 600;
      min-width: 32px;
      text-align: right;
    }
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
