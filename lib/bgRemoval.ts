/**
 * Background removal — runs entirely in the user's browser.
 *
 * Powers: @imgly/background-removal (AGPL).
 * Uses the library's DEFAULT EXPORT, which is what the official docs use.
 * (A named `removeBackground` export does exist but behaves inconsistently
 * across versions — the default export is the supported entry point.)
 */

import imglyRemoveBackground from '@imgly/background-removal';

export type ProgressCallback = (key: string, current: number, total: number) => void;

export interface RemoveOptions {
  onProgress?: ProgressCallback;
}

/**
 * Removes the background from an image and returns a transparent PNG blob.
 */
export async function removeBackground(
  input: Blob | File,
  options: RemoveOptions = {}
): Promise<Blob> {
  // Defensive progress wrapper — coerces all args so the library's varying
  // progress signature can never crash our UI.
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

  // Some clipboard-pasted images arrive as Blobs without a .name; the library
  // calls .replace() on it internally and crashes. Normalize to a real File.
  const normalized = await normalizeInput(input);

  // Minimal config — let the library use its own defaults for everything
  // we don't strictly need to override. The library's TS types are narrower
  // than its runtime accepts, so we cast.
  const config: any = {
    debug: false,
    progress: safeProgress,
  };

  return imglyRemoveBackground(normalized, config);
}

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
