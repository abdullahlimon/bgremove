/**
 * Resize presets, units, and helpers.
 *
 * Custom dimensions can be expressed in pixels, millimetres, or centimetres.
 * mm/cm conversions assume 300 DPI (print quality).
 */

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  hint: string;
}

export type Unit = 'px' | 'mm' | 'cm';

/** Print quality: 300 dots per inch — the standard for photo prints. */
export const DPI = 300;

/** 1 inch = 25.4 mm. So pixels-per-mm at 300 DPI = 300 / 25.4 ≈ 11.811. */
export const PX_PER_MM = DPI / 25.4;

/** Helper to compute a dim in pixels from millimetres at 300 DPI. */
const mm = (n: number) => Math.round(n * PX_PER_MM);

/**
 * Sources:
 *  - Instagram post: 1080×1080 (square, 1:1)
 *  - Instagram story / Reels: 1080×1920 (9:16)
 *  - Facebook cover: 820×312
 *  - Passport (US): 2"×2" → 600×600 px @ 300 DPI
 *  - Passport (35×45mm, ICAO): UK, India, Australia, most of EU/Asia
 *  - Passport (35×50mm): Bangladesh, some other countries
 */
export const SIZE_PRESETS: SizePreset[] = [
  { id: 'original',     label: 'Original',           width: 0,        height: 0,        hint: 'No resize' },
  { id: 'ig-post',      label: 'Instagram post',     width: 1080,     height: 1080,     hint: '1:1' },
  { id: 'ig-story',     label: 'Instagram story',    width: 1080,     height: 1920,     hint: '9:16' },
  { id: 'fb-cover',     label: 'Facebook cover',     width: 820,      height: 312,      hint: '2.63:1' },
  { id: 'passport-us',  label: 'Passport US 2×2"',   width: 600,      height: 600,      hint: '300 dpi' },
  { id: 'passport-35x45', label: 'Passport 35×45mm', width: mm(35),   height: mm(45),   hint: 'ICAO · 300 dpi' },
  { id: 'passport-35x50', label: 'Passport 35×50mm', width: mm(35),   height: mm(50),   hint: '300 dpi' },
  { id: 'custom',       label: 'Custom',             width: 0,        height: 0,        hint: 'Set W × H' },
];

export const PRESET_BY_ID = Object.fromEntries(SIZE_PRESETS.map(p => [p.id, p]));

export const MIN_DIMENSION = 16;
export const MAX_DIMENSION = 8192;

/** Convert a value from any supported unit to pixels (rounded). */
export function toPixels(value: number, unit: Unit): number {
  if (!Number.isFinite(value) || value <= 0) return MIN_DIMENSION;
  let px: number;
  switch (unit) {
    case 'mm': px = value * PX_PER_MM; break;
    case 'cm': px = value * PX_PER_MM * 10; break;
    case 'px':
    default:   px = value;
  }
  return clampDimension(Math.round(px));
}

/** Convert pixels to the given unit (rounded to 1 decimal for mm/cm). */
export function fromPixels(px: number, unit: Unit): number {
  if (!Number.isFinite(px) || px <= 0) return 0;
  switch (unit) {
    case 'mm': return Math.round((px / PX_PER_MM) * 10) / 10;
    case 'cm': return Math.round((px / (PX_PER_MM * 10)) * 10) / 10;
    case 'px':
    default:   return Math.round(px);
  }
}

export function clampDimension(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return MIN_DIMENSION;
  return Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Math.round(n)));
}

/**
 * Decide the final output size given a preset choice + the original image.
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
