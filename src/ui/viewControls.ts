/**
 * viewControls.ts — Controles de vista 3D estilo GeoGebra.
 *
 * La cámara del visor está FIJA (no se arrastra); se orienta solo con estos
 * sliders: girar (azimut), inclinar (elevación) y zoom. Emite los valores por
 * un callback; app.ts los conecta a viewer.setView.
 *
 * También expone un selector de paletas de colores (Cálido / Daltónico / Neón
 * / Pastel). Al cambiar se llama setPalette() y luego handlers.onPalette().
 */

import { setPalette, getPalette, listPalettes } from '../core/colors.js';
import type { PaletteName } from '../core/colors.js';

export interface ViewControlsHandlers {
  onView(azimuthDeg: number, elevationDeg: number, zoom: number): void;
  /** Llamado cuando el usuario cambia la paleta de colores.
   *  Ya se habrá aplicado setPalette() antes de invocar este callback.
   *  La app debe disparar un re-render completo para propagar los colores nuevos. */
  onPalette?(): void;
}

export function createViewControls(
  container: HTMLElement,
  handlers: ViewControlsHandlers,
): { current(): { az: number; el: number; zoom: number } } {
  injectStyles();

  let az = 35;
  let el = 20;
  let zoom = 1;

  const root = document.createElement('div');
  root.className = 'vc-root';
  container.appendChild(root);

  const title = document.createElement('div');
  title.className = 'vc-title';
  title.textContent = 'Vista 3D';
  root.appendChild(title);

  const make = (
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    fmt: (v: number) => string,
    set: (v: number) => void,
  ): void => {
    const row = document.createElement('div');
    row.className = 'vc-row';

    const lbl = document.createElement('span');
    lbl.className = 'vc-label';
    lbl.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'vc-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    slider.setAttribute('aria-label', label);

    const val = document.createElement('span');
    val.className = 'vc-val';
    val.textContent = fmt(value);

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      set(v);
      val.textContent = fmt(v);
      handlers.onView(az, el, zoom);
    });

    row.append(lbl, slider, val);
    root.appendChild(row);
  };

  make('Girar', 0, 360, 1, az, (v) => `${v | 0}°`, (v) => (az = v));
  make('Inclinar', -89, 89, 1, el, (v) => `${v | 0}°`, (v) => (el = v));
  make('Zoom', 0.4, 2.5, 0.05, zoom, (v) => `×${v.toFixed(2)}`, (v) => (zoom = v));

  // ---- Selector de paleta ----
  const palettes = listPalettes();

  const paletteRow = document.createElement('div');
  paletteRow.className = 'vc-row';

  const paletteLbl = document.createElement('span');
  paletteLbl.className = 'vc-label';
  paletteLbl.textContent = 'Paleta';

  const paletteSelect = document.createElement('select');
  paletteSelect.className = 'vc-palette-select';
  paletteSelect.setAttribute('aria-label', 'Paleta de colores');

  for (const p of palettes) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    paletteSelect.appendChild(opt);
  }
  paletteSelect.value = getPalette();

  // Preview: 3 puntitos con los colores de la paleta elegida
  const dotsWrap = document.createElement('span');
  dotsWrap.className = 'vc-palette-dots';

  function renderDots(paletteId: PaletteName): void {
    dotsWrap.innerHTML = '';
    const pal = palettes.find((p) => p.id === paletteId);
    if (!pal) return;
    for (const color of pal.colors) {
      const dot = document.createElement('span');
      dot.className = 'vc-palette-dot';
      dot.style.background = color;
      dotsWrap.appendChild(dot);
    }
  }

  renderDots(getPalette());

  paletteSelect.addEventListener('change', () => {
    const newPalette = paletteSelect.value as PaletteName;
    setPalette(newPalette);
    renderDots(newPalette);
    handlers.onPalette?.();
  });

  paletteRow.append(paletteLbl, paletteSelect, dotsWrap);
  root.appendChild(paletteRow);

  // Emitir la vista inicial.
  handlers.onView(az, el, zoom);

  return { current: () => ({ az, el, zoom }) };
}

function injectStyles(): void {
  if (document.getElementById('vc-styles')) return;
  const style = document.createElement('style');
  style.id = 'vc-styles';
  style.textContent = `
    .vc-root {
      background: var(--panel, #14172a);
      border: 1px solid var(--line, #252a44);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .vc-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--muted, #7a759e);
      margin-bottom: 2px;
    }
    .vc-row {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .vc-label {
      width: 56px;
      flex-shrink: 0;
      font-size: 12px;
      color: var(--text, #dcd8f5);
    }
    .vc-slider {
      flex: 1;
      accent-color: var(--indigo, #7c5cff);
      cursor: pointer;
      min-width: 0;
    }
    .vc-val {
      width: 42px;
      flex-shrink: 0;
      text-align: right;
      font-size: 11px;
      font-family: ui-monospace, monospace;
      color: var(--lavender, #c4b5fd);
    }
    .vc-palette-select {
      flex: 1;
      min-width: 0;
      background: #0f0f23;
      border: 1px solid #3d3d60;
      color: #e0e0f0;
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }
    .vc-palette-select:focus {
      border-color: #7c5cff;
      box-shadow: 0 0 0 2px rgba(124, 92, 255, 0.2);
    }
    .vc-palette-dots {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .vc-palette-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.15);
    }
  `;
  document.head.appendChild(style);
}
