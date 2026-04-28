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
 * The library's API is finicky about config types across versions, so we
 * pass a minimal, defensively-typed config and rely on its defaults.
 */
export async function removeBackground(
  input: Blob | File,
  options: RemoveOptions = {}
): Promise<Blob> {
  // Defensive progress wrapper — the library's progress signature varies
  // across versions and can be called with non-string keys, which would
  // crash anything that does `key.startsWith(...)` on the receiving side.
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

  // Some File objects (e.g. from clipboard paste) have empty/undefined .name,
  // and some library versions call .replace() on it internally. Normalize to
  // a real File with a guaranteed name before handing off.
  const normalized = await normalizeInput(input);

  // Cast to `any` — the library's TypeScript types are stricter than its
  // runtime accepts, especially around progress callback shape.
  const config: any = {
    progress: safeProgress,
    debug: false,
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
