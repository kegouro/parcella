// exporter.ts — descarga de imágenes del visor.

/** Dispara la descarga de un dataURL (PNG) con el nombre dado. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
