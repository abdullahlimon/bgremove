/**
 * Resize presets and helpers.
 *
 * Each preset has fixed pixel dimensions tuned for the platform's current
 * recommended size. Custom dimensions are also supported.
 */

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Short hint shown under the label, e.g. "1:1". */
  hint: string;
}

/**
 * Sources:
 *  - Instagram post: 1080×1080 (square, 1:1)
 *  - Instagram story / Reels: 1080×1920 (9:16)
 *  - Facebook cover: 820×312 (Facebook's current spec)
 *  - Passport photo (US): 600×600 px @ 300dpi corresponds to 2"×2".
 *    Different countries have different requirements; the user can use
 *    Custom for non-US passport photos.
 */
export const SIZE_PRESETS: SizePreset[] = [
  { id: 'original',  label: 'Original',          width: 0,    height: 0,    hint: 'No resize' },
  { id: 'ig-post',   label: 'Instagram post',    width: 1080, height: 1080, hint: '1:1' },
  { id: 'ig-story',  label: 'Instagram story',   width: 1080, height: 1920, hint: '9:16' },
  { id: 'fb-cover',  label: 'Facebook cover',    width: 820,  height: 312,  hint: '2.63:1' },
  { id: 'passport',  label: 'Passport (US 2×2)', width: 600,  height: 600,  hint: '300 dpi' },
  { id: 'custom',    label: 'Custom',            width: 0,    height: 0,    hint: 'Set W × H' },
];

export const PRESET_BY_ID = Object.fromEntries(SIZE_PRESETS.map(p => [p.id, p]));

/**
 * Reasonable safety bounds — the canvas API has practical upper limits
 * on most browsers around 16384×16384, but we cap lower for memory's sake.
 */
export const MIN_DIMENSION = 16;
export const MAX_DIMENSION = 8192;

export function clampDimension(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return MIN_DIMENSION;
  return Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Math.round(n)));
}

/**
 * Decide the final output size given a preset choice + the original image.
 * Returns null when "original" is chosen (caller should use natural size).
 */
export function resolveSize(
  presetId: string,
  customW: number,
  customH: number,
  fallbackW: number,
  fallbackH: number
): { width: number; height: number } {
  if (presetId === 'original') {
    return { width: fallbackW, height: fallbackH };
  }
  if (presetId === 'custom') {
    return { width: clampDimension(customW), height: clampDimension(customH) };
  }
  const preset = PRESET_BY_ID[presetId];
  if (!preset) return { width: fallbackW, height: fallbackH };
  return { width: preset.width, height: preset.height };
}
