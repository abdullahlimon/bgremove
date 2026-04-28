/**
 * Compositor — renders a foreground (transparent PNG of the subject) on top
 * of a chosen background using the HTML Canvas API. Pure browser, no deps.
 */

export type SolidBg = { type: 'solid'; color: string };
export type GradientBg = {
  type: 'gradient';
  from: string;
  to: string;
  /** 0..360 in degrees. 0 = top-to-bottom, 90 = left-to-right. */
  angle: number;
};
export type ImageBg = { type: 'image'; image: HTMLImageElement | null; blur?: number };
export type BlurBg = { type: 'blur'; original: HTMLImageElement | null; amount: number };
export type TransparentBg = { type: 'transparent' };

export type Background =
  | SolidBg
  | GradientBg
  | ImageBg
  | BlurBg
  | TransparentBg;

/**
 * Compose a foreground image onto a chosen background.
 * Returns a fresh canvas — caller decides how to use it (preview, export, etc).
 *
 * Foreground uses "cover" semantics: the subject fills the entire output frame,
 * cropping edges as needed to maintain aspect ratio. This is what users expect
 * for passport photos, social posts, etc. — no white/transparent letterboxing.
 */
export function composite(
  foreground: HTMLImageElement,
  background: Background,
  width: number = foreground.naturalWidth,
  height: number = foreground.naturalHeight
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // High-quality downscaling — important when the source image is much
  // larger than the target (typical for "1080×1080 from 4000×4000" exports).
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawBackground(ctx, background, width, height);

  // Draw the foreground using cover semantics — fills the frame, may crop.
  drawImageCover(ctx, foreground, 0, 0, width, height);

  return canvas;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: Background,
  width: number,
  height: number
): void {
  switch (bg.type) {
    case 'transparent':
      return;

    case 'solid':
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, width, height);
      return;

    case 'gradient': {
      const radians = ((bg.angle - 90) * Math.PI) / 180;
      const cx = width / 2;
      const cy = height / 2;
      const halfDiag = Math.sqrt(width * width + height * height) / 2;
      const x1 = cx - Math.cos(radians) * halfDiag;
      const y1 = cy - Math.sin(radians) * halfDiag;
      const x2 = cx + Math.cos(radians) * halfDiag;
      const y2 = cy + Math.sin(radians) * halfDiag;

      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, bg.from);
      gradient.addColorStop(1, bg.to);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    case 'image': {
      if (!bg.image) return;
      drawImageCover(ctx, bg.image, 0, 0, width, height);
      if (bg.blur && bg.blur > 0) {
        applyCanvasBlur(ctx, width, height, bg.blur);
      }
      return;
    }

    case 'blur': {
      if (!bg.original) return;
      ctx.filter = `blur(${bg.amount}px)`;
      drawImageCover(ctx, bg.original, 0, 0, width, height);
      ctx.filter = 'none';
      return;
    }
  }
}

/** Draw an image with "cover" semantics (fills target, crops as needed). */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  const ir = img.naturalWidth / img.naturalHeight;
  const tr = dw / dh;

  let sx: number, sy: number, sw: number, sh: number;
  if (ir > tr) {
    // Source is wider than target — crop horizontally.
    sh = img.naturalHeight;
    sw = sh * tr;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    // Source is taller — crop vertically.
    sw = img.naturalWidth;
    sh = sw / tr;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** Apply a Gaussian-style blur to whatever's currently on the canvas. */
function applyCanvasBlur(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  const tmp = document.createElement('canvas');
  tmp.width = width;
  tmp.height = height;
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.drawImage(ctx.canvas, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.filter = `blur(${amount}px)`;
  ctx.drawImage(tmp, 0, 0);
  ctx.filter = 'none';
}

/** Helper: load any Blob/URL into an HTMLImageElement. */
export function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
    img.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  });
}
