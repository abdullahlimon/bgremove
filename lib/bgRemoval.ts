/**
 * Background removal — runs entirely in the user's browser.
 *
 * Powers: @imgly/background-removal v1.4.x (AGPL).
 * Model weights are cached in IndexedDB after first download.
 *
 * We explicitly request the higher-quality 'medium' model variant. The
 * library defaults to a faster/smaller model that struggles with fabric
 * edges (hijabs, hair, soft shadows) — bumping this gives noticeably
 * cleaner cutouts at the cost of ~20 extra seconds of model download
 * the very first time, and slightly slower inference.
 */

import imglyRemoveBackground from '@imgly/background-removal';

export type ProgressCallback = (key: string, current: number, total: number) => void;

export interface RemoveOptions {
  onProgress?: ProgressCallback;
}

export async function removeBackground(
  input: Blob | File,
  options: RemoveOptions = {}
): Promise<Blob> {
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

  const normalized = await normalizeInput(input);

  // The library's TypeScript types are narrower than its runtime.
  // The 'model' field accepts: 'small' | 'medium' (in v1.4.x) — 'medium' is
  // the larger U²-Net variant that handles fabric and hair edges much better.
  const config: any = {
    debug: false,
    model: 'medium',
    progress: safeProgress,
    output: {
      format: 'image/png',
      quality: 1.0,
    },
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
