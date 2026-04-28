/**
 * Background removal — runs entirely in the user's browser.
 *
 * Powers: @imgly/background-removal (MIT-licensed)
 *   - Uses ONNX Runtime Web with a quantized U²-Net variant
 *   - Model weights are ~40 MB, downloaded on first use, then cached in
 *     the browser's IndexedDB so subsequent uses are instant.
 *   - No network requests after the first model load.
 *   - No data ever leaves the user's device.
 *
 * This file intentionally hides the library behind a tiny API so the
 * rest of the app could swap implementations later (e.g. a self-hosted
 * Hugging Face Space) without changing UI code.
 */

import { removeBackground as imglyRemoveBackground, type Config } from '@imgly/background-removal';

export type ProgressCallback = (key: string, current: number, total: number) => void;

export interface RemoveOptions {
  /** Called repeatedly with model-download / inference progress. */
  onProgress?: ProgressCallback;
  /** 'medium' is the sweet spot for quality vs speed. */
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Removes the background from an image and returns a transparent PNG blob.
 *
 * @param input - File from <input type="file"> or any Blob/URL the library accepts.
 * @returns A PNG Blob with the background removed (alpha channel preserved).
 */
export async function removeBackground(
  input: Blob | File,
  options: RemoveOptions = {}
): Promise<Blob> {
  const config: Config = {
    // Show progress so we can drive the UI's progress bar.
    progress: options.onProgress,

    // 'medium' = good quality, reasonable speed. The 'isnet_fp16' model is
    // smaller and fast enough on most modern devices. We could expose this
    // as a user setting later.
    model: options.quality === 'high' ? 'isnet' : 'isnet_fp16',

    // PNG with alpha channel — this is the whole point.
    output: {
      format: 'image/png',
      quality: 1.0,
    },

    // Quiet down library logs in production.
    debug: false,
  };

  return imglyRemoveBackground(input, config);
}

/**
 * Pre-warm the model. Call this when the user lands on the page so the
 * model starts downloading in the background while they choose an image.
 * It's a no-op if the model is already cached.
 *
 * We trigger pre-warming by running the library against a 1x1 pixel.
 * This forces the model to load without doing real work.
 */
export async function preloadModel(onProgress?: ProgressCallback): Promise<void> {
  try {
    // 1x1 transparent PNG.
    const tinyPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const blob = new Blob([tinyPng], { type: 'image/png' });
    await imglyRemoveBackground(blob, { progress: onProgress, debug: false });
  } catch {
    // Pre-warm failures aren't fatal — the real call will just take longer.
  }
}
