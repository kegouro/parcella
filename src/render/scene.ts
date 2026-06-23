/**
 * scene.ts — Escena Three.js base para Parcella.
 *
 * Crea la escena, cámara, luces, OrbitControls, ejes/grid y el render loop.
 * Fondo "pizarra" (#10131c) con acento índigo (#7c5cff).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------------------------------------------------------------------------
// Constantes de estilo
// ---------------------------------------------------------------------------

const BG_COLOR = 0x10131c;
const GRID_COLOR = 0x1e2333;
const AXIS_X_COLOR = 0xff4d6a;   // rojo-coral
const AXIS_Y_COLOR = 0x4dffb4;   // verde-menta
const AXIS_Z_COLOR = 0x5ca4ff;   // azul
const LABEL_COLOR = '#a0a8c0';

// ---------------------------------------------------------------------------
// SceneContext — todo lo que necesitan los demás módulos
// ---------------------------------------------------------------------------

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  css2dRenderer: CSS2DRenderer;
  controls: OrbitControls;
  /** Llama dispose() para parar el loop y liberar recursos. */
  dispose(): void;
  /** Ajusta el tamaño del renderer al contenedor. */
  resize(): void;
}

// ---------------------------------------------------------------------------
// createScene
// ---------------------------------------------------------------------------

export function createScene(container: HTMLElement): SceneContext {
  // --- Renderer WebGL ---
  // preserveDrawingBuffer: garantiza que canvas.toDataURL (export PNG y grabación
  // de GIF) lea siempre un frame válido, no un buffer ya vaciado.
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(BG_COLOR, 1);
  renderer.shadowMap.enabled = false;
  // El contenedor necesita position relative para que el overlay CSS2D se posicione correctamente
  container.style.position = 'relative';
  container.appendChild(renderer.domElement);

  // --- CSS2DRenderer (overlay para rótulos HTML anclados a puntos 3D) ---
  const css2dRenderer = new CSS2DRenderer();
  css2dRenderer.domElement.style.position = 'absolute';
  css2dRenderer.domElement.style.top = '0';
  css2dRenderer.domElement.style.left = '0';
  css2dRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(css2dRenderer.domElement);

  // --- Inyectar estilos de .r-label (una sola vez) ---
  _injectLabelStyles();

  // --- Escena ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);

  // --- Cámara ---
  const { clientWidth: w, clientHeight: h } = container;
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 500);
  camera.position.set(4, 3, 5);
  camera.lookAt(0, 0, 0);

  // --- OrbitControls ---
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.2;
  controls.maxDistance = 200;

  // --- Luces ---
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 8, 5);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x8090ff, 0.3);
  fillLight.position.set(-3, -2, -4);
  scene.add(fillLight);

  // --- Grid de piso ---
  const grid = new THREE.GridHelper(10, 20, GRID_COLOR, GRID_COLOR);
  (grid.material as THREE.Material).opacity = 0.35;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);

  // --- Ejes ---
  _addAxes(scene);

  // --- Render loop ---
  let animFrameId = 0;
  let running = true;

  function animate() {
    if (!running) return;
    animFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    css2dRenderer.render(scene, camera);
  }

  resize();
  animate();

  function resize() {
    const pw = container.clientWidth  || 400;
    const ph = container.clientHeight || 300;
    renderer.setSize(pw, ph);
    css2dRenderer.setSize(pw, ph);
    camera.aspect = pw / ph;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    running = false;
    cancelAnimationFrame(animFrameId);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
    if (css2dRenderer.domElement.parentElement) {
      css2dRenderer.domElement.parentElement.removeChild(css2dRenderer.domElement);
    }
  }

  return { scene, camera, renderer, css2dRenderer, controls, dispose, resize };
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function _addAxes(scene: THREE.Scene) {
  const LEN = 3;

  // Líneas de eje con ArrowHelper
  const dirs: [THREE.Vector3, number, string][] = [
    [new THREE.Vector3(1, 0, 0), AXIS_X_COLOR, 'X'],
    [new THREE.Vector3(0, 1, 0), AXIS_Y_COLOR, 'Y'],
    [new THREE.Vector3(0, 0, 1), AXIS_Z_COLOR, 'Z'],
  ];

  for (const [dir, color] of dirs) {
    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), LEN, color, 0.18, 0.10);
    scene.add(arrow);
  }

  // Rótulos de eje como sprites de canvas
  for (const [dir, , label] of dirs) {
    const sprite = _makeTextSprite(label, LABEL_COLOR);
    const pos = dir.clone().multiplyScalar(LEN + 0.28);
    sprite.position.copy(pos);
    sprite.scale.set(0.5, 0.25, 1);
    scene.add(sprite);
  }
}

/** Inyecta los estilos de .r-label en <head> (con guard para no duplicar). */
function _injectLabelStyles(): void {
  const STYLE_ID = 'parcella-r-label-styles';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .r-label {
      display: inline-block;
      padding: 2px 7px;
      background: rgba(16, 19, 28, 0.78);
      border: 1px solid #7c5cff;
      border-radius: 4px;
      color: #e0e4f4;
      font-size: 11px;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      line-height: 1.5;
      white-space: nowrap;
      backdrop-filter: blur(2px);
      box-shadow: 0 1px 6px rgba(0,0,0,0.45);
      pointer-events: none;
      user-select: none;
    }
    .r-label .katex { font-size: 1em; }
  `;
  document.head.appendChild(style);
}

function _makeTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 32);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 16);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  return new THREE.Sprite(mat);
}
