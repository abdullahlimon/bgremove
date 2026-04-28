/**
 * Export — convert a canvas to a download. PNG keeps transparency,
 * JPG is smaller but flattens transparency to white.
 */

export type ExportFormat = 'png' | 'jpg';

export interface ExportOptions {
  format: ExportFormat;
  /** JPG only — 0..1, default 0.95. PNG ignores this. */
  quality?: number;
}

/**
 * Export the canvas as a Blob.
 *
 * For JPG, we composite onto white first to avoid the black backdrop that
 * canvas defaults to when transparent pixels are flattened.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const sourceCanvas =
      options.format === 'jpg' ? flattenForJpeg(canvas) : canvas;

    const mime = options.format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = options.format === 'png' ? undefined : options.quality ?? 0.95;

    sourceCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas export failed.'));
          return;
        }
        resolve(blob);
      },
      mime,
      quality
    );
  });
}

/**
 * JPEG has no alpha channel. Flatten to a white background so transparent
 * areas don't become black — matches what users expect from "Save as JPG".
 */
function flattenForJpeg(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);
  return out;
}

/** Trigger a download for a given blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick before revoking, otherwise some browsers
  // cancel the download on slow machines.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Build a sensible filename from the original. */
export function suggestedFilename(
  original: string | undefined,
  format: ExportFormat
): string {
  const base = (original || 'image').replace(/\.[^.]+$/, '');
  const ext = format === 'png' ? 'png' : 'jpg';
  return `${base}-bgremoved.${ext}`;
}
