/**
 * render/index.ts — Punto de entrada de la capa de render de Parcella.
 *
 * Exporta `createViewer` y la interfaz `Viewer`.
 * El viewer reconstruye la escena completa cada vez que se llama `update(state)`.
 */

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { AppState, Vec3 } from '../core/types.js';
import { getSystem } from '../core/coords.js';
import { sweptSamples, elementCell } from '../core/differential.js';

import { createScene } from './scene.js';
import type { SceneContext } from './scene.js';
import { buildCoordGrid, disposeCoordGrid } from './coordGrid.js';
import { buildSweepMesh, disposeSweepMesh } from './sweepMesh.js';
import type { SweepMeshResult } from './sweepMesh.js';
import { buildElementMesh, disposeElementMesh } from './elementMesh.js';
import type { ElementMeshResult } from './elementMesh.js';
import { buildFieldColors, applyFieldColors, buildVectorArrows, disposeVectorArrows } from './fieldViz.js';

// ---------------------------------------------------------------------------
// Interfaz pública del Viewer
// ---------------------------------------------------------------------------

export interface Viewer {
  /**
   * Reconstruye la escena completa desde el estado de la aplicación.
   * Dispone los objetos previos para no acumular memoria.
   */
  update(state: AppState): void;

  /**
   * Actualización barata: solo reposiciona el elemento diferencial
   * sin recalcular el barrido completo.
   * p ∈ [0,1] es el progreso global del barrido (reservado para Fase 2).
   */
  setProgress(p: number): void;

  /** Orienta la cámara fija desde sliders (azimut/elevación en grados, zoom multiplicador). */
  setView(azimuthDeg: number, elevationDeg: number, zoom: number): void;

  /** Ajusta el renderer al tamaño del contenedor. */
  resize(): void;

  /** Devuelve el contenido del canvas como PNG en base64. */
  toDataURL(): string;

  /** Libera todos los recursos Three.js y detiene el render loop. */
  dispose(): void;

  /**
   * Coloca rótulos de texto/HTML anclados a puntos 3D mediante CSS2DRenderer.
   *
   * - Cada entrada posiciona un `CSS2DObject` en `position` (coordenadas del mundo).
   *   `html` es HTML listo (puede contener KaTeX renderizado); se inserta como
   *   innerHTML de un `<div class="r-label">`.
   * - `setLabels([])` elimina todos los rótulos actuales.
   * - Llamar `setLabels` reemplaza los rótulos anteriores por completo.
   * - `update()` NO borra los rótulos; el dueño (app/ui) debe llamar
   *   `setLabels([])` o `setLabels(nuevos)` cuando corresponda.
   */
  setLabels(labels: { position: Vec3; html: string }[]): void;
}

// ---------------------------------------------------------------------------
// createViewer
// ---------------------------------------------------------------------------

/**
 * Crea e inicializa el Viewer 3D de Parcella en el contenedor DOM dado.
 *
 * @param container  Elemento HTML que contendrá el canvas de Three.js.
 * @returns          Interfaz Viewer.
 */
export function createViewer(container: HTMLElement): Viewer {
  const ctx: SceneContext = createScene(container);

  // Grupos de objetos actuales (para limpiar en cada update)
  let coordGridGroup: THREE.Group | null = null;
  let sweepResult:    SweepMeshResult | null = null;
  let elemResult:     ElementMeshResult | null = null;
  let vectorArrowGroup: THREE.Group | null = null;

  // Estado más reciente (para setProgress)
  let lastState: AppState | null = null;

  // CSS2DObjects actuales para rótulos (setLabels)
  let labelObjects: CSS2DObject[] = [];

  // -------------------------------------------------------------------------
  // update — reconstruye todo
  // -------------------------------------------------------------------------

  function update(state: AppState): void {
    lastState = state;
    _clearScene();

    // --- Grilla de coordenadas (no depende del progreso) ---
    try {
      coordGridGroup = buildCoordGrid(state);
      ctx.scene.add(coordGridGroup);
    } catch {
      // Región inválida: sin grilla
    }

    // --- Barrido + elemento (dependen del progreso) ---
    _buildSweepAndElement(state, 32);
  }

  /**
   * (Re)construye el barrido y el elemento desde el estado dado, disponiendo los
   * previos. NO toca la grilla de coordenadas. Lo usan update() y setProgress():
   * por eso al darle play la REGIÓN se anima, no solo el trocito.
   */
  function _buildSweepAndElement(state: AppState, res = 24): void {
    if (sweepResult) { disposeSweepMesh(sweepResult); ctx.scene.remove(sweepResult.group); sweepResult = null; }
    if (elemResult) { disposeElementMesh(elemResult); ctx.scene.remove(elemResult.group); elemResult = null; }
    if (vectorArrowGroup) { disposeVectorArrows(vectorArrowGroup, ctx.scene); vectorArrowGroup = null; }

    const system = getSystem(state.region.system);

    // --- Barrido ---
    try {
      const samples = sweptSamples(state.region, system, state.sweep, res);
      sweepResult = buildSweepMesh(
        samples.kind, samples.point, samples.curve, samples.surface, samples.solidFaces,
        state.sweep.active,
      );
      ctx.scene.add(sweepResult.group);

      if (state.integrand.mode === 'scalar' && state.integrand.scalar && samples.kind === 'surface' && samples.surface) {
        _applyScalarColorsToSweep(state, samples.surface, sweepResult);
      }
      if (state.integrand.mode === 'vector') {
        const arrowSamples =
          samples.kind === 'surface' && samples.surface ? samples.surface
          : samples.kind === 'curve' && samples.curve ? samples.curve : null;
        if (arrowSamples) {
          vectorArrowGroup = buildVectorArrows(state, arrowSamples);
          if (vectorArrowGroup) ctx.scene.add(vectorArrowGroup);
        }
      }
    } catch {
      // Barrido inválido: no se dibuja
    }

    // --- Elemento diferencial ---
    try {
      const cell = elementCell(state.region, system, state.sweep);
      elemResult = buildElementMesh(cell.center, cell.edges, state.sweep.active);
      ctx.scene.add(elemResult.group);
    } catch {
      // Posición inválida: no se dibuja
    }
  }

  // -------------------------------------------------------------------------
  // setProgress — actualización ligera del elemento diferencial
  // -------------------------------------------------------------------------

  function setProgress(_p: number): void {
    // Reconstruye barrido + elemento desde el estado actual (cuyo progress ya fue
    // mutado por el dueño en app.ts). Así la región se ANIMA al darle play, no solo
    // el trocito. Resolución algo menor para que la animación sea fluida.
    if (!lastState) return;
    _buildSweepAndElement(lastState, 22);
  }

  // -------------------------------------------------------------------------
  // setLabels — rótulos HTML anclados a puntos 3D
  // -------------------------------------------------------------------------

  function setLabels(labels: { position: Vec3; html: string }[]): void {
    // Eliminar rótulos anteriores de la escena
    for (const obj of labelObjects) {
      ctx.scene.remove(obj);
      // CSS2DObject no tiene geometría/material que liberar, pero limpiamos el DOM
      if (obj.element.parentElement) {
        obj.element.parentElement.removeChild(obj.element);
      }
    }
    labelObjects = [];

    // Crear los nuevos rótulos
    for (const { position, html } of labels) {
      const div = document.createElement('div');
      div.className = 'r-label';
      div.innerHTML = html;

      const label = new CSS2DObject(div);
      label.position.set(position[0], position[1], position[2]);
      ctx.scene.add(label);
      labelObjects.push(label);
    }
  }

  // -------------------------------------------------------------------------
  // resize / toDataURL / dispose
  // -------------------------------------------------------------------------

  function resize(): void {
    ctx.resize();
  }

  function toDataURL(): string {
    // Fuerza un render inmediato para capturar el frame actual
    ctx.renderer.render(ctx.scene, ctx.camera);
    return ctx.renderer.domElement.toDataURL('image/png');
  }

  function dispose(): void {
    setLabels([]); // limpiar CSS2DObjects antes de disponer la escena
    _clearScene();
    ctx.dispose();
  }

  // -------------------------------------------------------------------------
  // Helpers privados
  // -------------------------------------------------------------------------

  function _clearScene(): void {
    if (coordGridGroup) {
      disposeCoordGrid(coordGridGroup);
      ctx.scene.remove(coordGridGroup);
      coordGridGroup = null;
    }
    if (sweepResult) {
      disposeSweepMesh(sweepResult);
      ctx.scene.remove(sweepResult.group);
      sweepResult = null;
    }
    if (elemResult) {
      disposeElementMesh(elemResult);
      ctx.scene.remove(elemResult.group);
      elemResult = null;
    }
    if (vectorArrowGroup) {
      disposeVectorArrows(vectorArrowGroup, ctx.scene);
      vectorArrowGroup = null;
    }
  }

  /**
   * Aplica colorización escalar a los meshes de la malla barrida.
   * Recorre el grupo buscando Mesh y aplica vertexColors.
   */
  function _applyScalarColorsToSweep(
    state: AppState,
    surface: [number, number, number][][],
    result: SweepMeshResult,
  ): void {
    try {
      const fieldResult = buildFieldColors(state, surface);
      result.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          applyFieldColors(obj, fieldResult);
        }
      });
    } catch {
      // Sin colorización si falla
    }
  }

  function setView(azimuthDeg: number, elevationDeg: number, zoom: number): void {
    ctx.setView(azimuthDeg, elevationDeg, zoom);
  }

  return { update, setProgress, setView, resize, toDataURL, dispose, setLabels };
}
