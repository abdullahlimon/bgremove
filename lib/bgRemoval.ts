/**
 * Background removal — runs entirely in the user's browser.
 *
 * Powers: @imgly/background-removal (MIT-licensed).
 * Model weights are ~40 MB, downloaded on first use, then cached in IndexedDB.
 */

import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

export type ProgressCallback = (key: string, current: number, total: number) => void;

export interface RemoveOptions {
  onProgress?: ProgressCallback;
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Removes the background from an image and returns a transparent PNG blob.
 *
 * v1.5+ of the library requires `publicPath` to be set — otherwise it tries
 * to call .replace() on `undefined` while constructing the model URL, which
 * surfaces to the user as "e.replace is not a function".
 */
export async function removeBackground(
  input: Blob | File,
  options: RemoveOptions = {}
): Promise<Blob> {
  // Defensive progress wrapper — coerces all args to safe types so the
  // library's progress reporter can never crash our app.
  const safeProgress = options.onProgress
    ? (key: unknown, current: unknown, total: unknown) => {
        try {
          const k = typeof key === 'string' ? key : String(key ?? 'progress');
          const c = Number.isFinite(Number(current)) ? Number(current) : 0;
          const t = Number.isFinite(Number(total)) ? Number(total) : 0;
          options.onProgress!(k, c, t);
        } catch {
          // Never let progress reporting kill inference.
        }
      }
    : undefined;

  // Some clipboard-pasted images arrive as Blobs with no .name, which the
  // library calls .replace() on internally. Wrap them in a proper File first.
  const normalized = await normalizeInput(input);

  // CRITICAL: publicPath tells the library where to download model weights
  // and WASM files. Without this, v1.5+ throws "e.replace is not a function".
  // The official jsDelivr CDN hosts these; trailing slash is required.
  const config: any = {
    publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/dist/',
    progress: safeProgress,
    debug: false,
    output: {
      format: 'image/png',
      quality: 1.0,
    },
  };

  return imglyRemoveBackground(normalized, config);
}

/**
 * Ensure the input is a File with a real name. Blobs and clipboard-pasted
 * images sometimes lack a name, which trips up the library internally.
 */
async function normalizeInput(input: Blob | File): Promise<File> {
  const hasName =
    typeof (input as File).name === 'string' && (input as File).name.length > 0;
  if (input instanceof File && hasName) {
    return input;
  }
  const type = input.type || 'image/png';
  const ext = type.includes('jpeg') || type.includes('jpg')
    ? 'jpg'
    : type.includes('webp')
      ? 'webp'
      : 'png';
  return new File([input], `upload.${ext}`, { type });
}
