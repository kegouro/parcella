/**
 * gifRecorder.ts — Graba el barrido del visor Parcella como GIF animado.
 *
 * Estrategia de captura:
 *   El WebGLRenderer de Three.js NO usa preserveDrawingBuffer, por lo que el
 *   buffer puede vaciarse tras el render. La vía segura es usar viewer.toDataURL()
 *   (que fuerza un renderer.render() explícito) → cargar como Image → dibujar en
 *   un canvas 2D offscreen para leer getImageData. drawImage directo desde el
 *   canvas WebGL funcionaría solo si el buffer estuviera preservado, lo cual no
 *   es el caso aquí.
 */

// gifenc no tiene tipos publicados; importamos con supresión de error de módulo.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface GifOptions {
  /** El canvas WebGL del visor. */
  canvas: HTMLCanvasElement;
  /** El caller llama a esta función para actualizar el visor al progreso t∈[0,1]. */
  onFrame: (t: number) => void;
  /** Número de frames del GIF. Por defecto 36. */
  frames?: number;
  /** Frames por segundo del GIF. Por defecto 18. */
  fps?: number;
  /**
   * Ancho máximo en píxeles; reescala manteniendo proporción.
   * Por defecto 720.
   */
  maxWidth?: number;
}

// ---------------------------------------------------------------------------
// recordSweepGif
// ---------------------------------------------------------------------------

/**
 * Captura `opts.frames` frames del barrido (t ∈ [0,1]) y devuelve un Blob GIF.
 *
 * Llama a opts.onFrame(t) para cada t, espera dos requestAnimationFrame para
 * que Three.js renderice, y captura los píxeles mediante toDataURL → Image →
 * drawImage en un canvas 2D offscreen (evita el problema del buffer no preservado).
 */
export async function recordSweepGif(opts: GifOptions): Promise<Blob> {
  const {
    canvas,
    onFrame,
    frames  = 36,
    fps     = 18,
    maxWidth = 720,
  } = opts;

  // --- Calcular dimensiones del canvas de salida ---
  const srcW = canvas.width;
  const srcH = canvas.height;
  const scale = srcW > maxWidth ? maxWidth / srcW : 1;
  const outW = Math.round(srcW * scale);
  const outH = Math.round(srcH * scale);

  // Canvas 2D offscreen para leer píxeles
  const offscreen = document.createElement('canvas');
  offscreen.width  = outW;
  offscreen.height = outH;
  const ctx2d = offscreen.getContext('2d');
  if (!ctx2d) throw new Error('gifRecorder: no se pudo obtener contexto 2D offscreen');

  const delay = Math.round(1000 / fps); // ms por frame

  // Inicializar el encoder GIF
  const encoder = GIFEncoder();
  encoder.writeHeader();

  // --- Capturar cada frame ---
  for (let i = 0; i < frames; i++) {
    const t = frames > 1 ? i / (frames - 1) : 0;

    // 1. Pedir al caller que actualice el visor al progreso t
    onFrame(t);

    // 2. Esperar dos RAF para que Three.js renderice el frame
    await waitFrames(2);

    // 3. Capturar los píxeles usando toDataURL (fuerza render interno en Three.js)
    //    y cargar como Image para dibujar en el canvas 2D offscreen
    const dataUrl = canvas.toDataURL('image/png');
    const img = await loadImage(dataUrl);

    ctx2d.clearRect(0, 0, outW, outH);
    ctx2d.drawImage(img, 0, 0, outW, outH);

    const imageData = ctx2d.getImageData(0, 0, outW, outH);
    const rgba = imageData.data; // Uint8ClampedArray, RGBA

    // 4. Cuantizar a 256 colores y armar el frame GIF
    const palette = quantize(rgba, 256);
    const index   = applyPalette(rgba, palette);
    encoder.writeFrame(index, outW, outH, { palette, delay, repeat: 0 });
  }

  encoder.finish();

  // Convertir el buffer del encoder a Blob
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const bytes: Uint8Array<ArrayBuffer> = encoder.bytesView() as Uint8Array<ArrayBuffer>;
  return new Blob([bytes], { type: 'image/gif' });
}

// ---------------------------------------------------------------------------
// downloadGif
// ---------------------------------------------------------------------------

/**
 * Descarga el Blob GIF con el nombre de archivo indicado.
 * Revoca el object URL tras disparar la descarga.
 */
export function downloadGif(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revocar en el siguiente tick para que el navegador alcance a iniciar la descarga
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

/** Espera n requestAnimationFrame antes de resolver. */
function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = n;
    function step() {
      remaining--;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/** Carga un dataURL como HTMLImageElement (espera el evento load). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('gifRecorder: no se pudo cargar la imagen del frame'));
    img.src = src;
  });
}
