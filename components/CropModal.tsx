'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CropModalProps {
  /** The image file the user just uploaded. */
  file: File;
  /** Called with the cropped File (same name, same type). */
  onCrop: (cropped: File) => void;
  /** Called when the user skips cropping — passes the original file through. */
  onSkip: () => void;
  /** Called when the user closes the modal entirely. */
  onCancel: () => void;
}

type Ratio = { id: string; label: string; value: number | null };

const RATIOS: Ratio[] = [
  { id: 'free',  label: 'Free',  value: null },
  { id: '1:1',   label: '1:1',   value: 1 / 1 },
  { id: '4:3',   label: '4:3',   value: 4 / 3 },
  { id: '3:4',   label: '3:4',   value: 3 / 4 },
  { id: '16:9',  label: '16:9',  value: 16 / 9 },
  { id: '9:16',  label: '9:16',  value: 9 / 16 },
];

interface CropRect {
  /** All values are in image-pixel coordinates (not screen pixels). */
  x: number;
  y: number;
  w: number;
  h: number;
}

type Drag =
  | { kind: 'none' }
  | { kind: 'move'; startX: number; startY: number; startCrop: CropRect }
  | {
      kind: 'resize';
      handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
      startX: number;
      startY: number;
      startCrop: CropRect;
    };

const MIN_CROP_PX = 16;

export default function CropModal({ file, onCrop, onSkip, onCancel }: CropModalProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState<Ratio>(RATIOS[0]);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [drag, setDrag] = useState<Drag>({ kind: 'none' });
  const [busy, setBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // ---- Load the image ----
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ---- Initialize crop to "centered, 80% of image" once image loads ----
  useEffect(() => {
    if (!img) return;
    setCrop(centeredCrop(img.naturalWidth, img.naturalHeight, ratio.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  // ---- When user changes ratio, snap crop to fit ----
  useEffect(() => {
    if (!img || !crop) return;
    if (ratio.value == null) return; // free — keep current crop
    setCrop(snapToRatio(crop, ratio.value, img.naturalWidth, img.naturalHeight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio]);

  // ---- Convert screen px ↔ image px using the rendered <img>'s rect ----
  const screenToImage = useCallback(
    (sx: number, sy: number) => {
      if (!imageRef.current || !img) return { x: 0, y: 0 };
      const r = imageRef.current.getBoundingClientRect();
      const scale = img.naturalWidth / r.width;
      return {
        x: (sx - r.left) * scale,
        y: (sy - r.top) * scale,
      };
    },
    [img]
  );

  const imageToScreenScale = useCallback(() => {
    if (!imageRef.current || !img) return 1;
    return imageRef.current.getBoundingClientRect().width / img.naturalWidth;
  }, [img]);

  // ---- Mouse / touch handlers ----
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, kind: 'move' | Drag['kind'] extends 'resize' ? never : 'move') => {
      if (!crop) return;
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDrag({
        kind: 'move',
        startX: e.clientX,
        startY: e.clientY,
        startCrop: { ...crop },
      });
    },
    [crop]
  );

  const startResize = useCallback(
    (e: React.PointerEvent, handle: Extract<Drag, { kind: 'resize' }>['handle']) => {
      if (!crop) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDrag({
        kind: 'resize',
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: { ...crop },
      });
    },
    [crop]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (drag.kind === 'none' || !img || !crop) return;
      const scale = 1 / imageToScreenScale();
      const dx = (e.clientX - drag.startX) * scale;
      const dy = (e.clientY - drag.startY) * scale;
      const W = img.naturalWidth;
      const H = img.naturalHeight;

      if (drag.kind === 'move') {
        const next: CropRect = {
          x: clamp(drag.startCrop.x + dx, 0, W - drag.startCrop.w),
          y: clamp(drag.startCrop.y + dy, 0, H - drag.startCrop.h),
          w: drag.startCrop.w,
          h: drag.startCrop.h,
        };
        setCrop(next);
        return;
      }

      if (drag.kind === 'resize') {
        const next = applyResize(drag.startCrop, drag.handle, dx, dy, W, H, ratio.value);
        setCrop(next);
      }
    },
    [drag, img, crop, imageToScreenScale, ratio]
  );

  const handlePointerUp = useCallback(() => {
    setDrag({ kind: 'none' });
  }, []);

  // ---- Apply crop and emit ----
  const handleConfirm = useCallback(async () => {
    if (!img || !crop) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(img, crop, file.type);
      const cropped = new File([blob], file.name, { type: file.type });
      onCrop(cropped);
    } catch {
      onCancel();
    } finally {
      setBusy(false);
    }
  }, [img, crop, file, onCrop, onCancel]);

  // ---- Render ----
  if (!img || !crop) {
    return (
      <Backdrop>
        <p className="text-white/60 text-sm">Loading image…</p>
      </Backdrop>
    );
  }

  const scale = imageToScreenScale();
  const cropPx = {
    left: crop.x * scale,
    top: crop.y * scale,
    width: crop.w * scale,
    height: crop.h * scale,
  };

  return (
    <Backdrop>
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full max-h-[90vh] gap-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-0">
          <div>
            <h2 className="text-white font-medium text-base">Crop image</h2>
            <p className="text-white/50 text-xs mt-0.5">Drag to move &middot; drag corners to resize</p>
          </div>
          <button
            onClick={onCancel}
            className="text-white/50 hover:text-white p-2"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Image + crop overlay */}
        <div
          ref={containerRef}
          className="flex-1 relative flex items-center justify-center min-h-0 select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="relative inline-block">
            <img
              ref={imageRef}
              src={img.src}
              alt=""
              draggable={false}
              className="max-w-full max-h-[60vh] object-contain pointer-events-none"
              style={{ filter: 'brightness(0.5)' }}
            />

            {/* Bright "window" — inner clipped image */}
            <div
              className="absolute overflow-hidden ring-2 ring-white/90 cursor-move"
              style={cropPx}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="absolute pointer-events-none"
                style={{
                  left: -cropPx.left,
                  top: -cropPx.top,
                  width: img.naturalWidth * scale,
                  height: img.naturalHeight * scale,
                  maxWidth: 'none',
                  maxHeight: 'none',
                }}
              />
              {/* Rule of thirds gridlines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 inset-x-0 h-px bg-white/30" />
                <div className="absolute top-2/3 inset-x-0 h-px bg-white/30" />
                <div className="absolute left-1/3 inset-y-0 w-px bg-white/30" />
                <div className="absolute left-2/3 inset-y-0 w-px bg-white/30" />
              </div>
            </div>

            {/* Corner + edge handles */}
            {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((h) => (
              <Handle
                key={h}
                handle={h}
                cropPx={cropPx}
                onPointerDown={(e) => startResize(e, h)}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 px-4 sm:px-0">
          <div className="flex flex-wrap gap-2 justify-center">
            {RATIOS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRatio(r)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs transition-colors
                  ${r.id === ratio.id
                    ? 'bg-accent text-white'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border border-white/10'}
                `}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-white/50 tabular-nums">
              {Math.round(crop.w)} × {Math.round(crop.h)} px
            </span>
            <div className="flex gap-2">
              <button
                onClick={onSkip}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 disabled:opacity-50"
              >
                Skip crop
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-hover text-white disabled:opacity-50"
              >
                {busy ? 'Cropping…' : 'Crop &amp; continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Backdrop>
  );
}

// ---- Helper components ----

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}

function Handle({
  handle,
  cropPx,
  onPointerDown,
}: {
  handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
  cropPx: { left: number; top: number; width: number; height: number };
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  // Position handles relative to the crop rect.
  const isCorner = handle.length === 2;
  const size = isCorner ? 14 : 10;
  const half = size / 2;

  const positions: Record<string, { left: number; top: number; cursor: string }> = {
    nw: { left: cropPx.left - half,                top: cropPx.top - half,                  cursor: 'nwse-resize' },
    ne: { left: cropPx.left + cropPx.width - half, top: cropPx.top - half,                  cursor: 'nesw-resize' },
    sw: { left: cropPx.left - half,                top: cropPx.top + cropPx.height - half,  cursor: 'nesw-resize' },
    se: { left: cropPx.left + cropPx.width - half, top: cropPx.top + cropPx.height - half,  cursor: 'nwse-resize' },
    n:  { left: cropPx.left + cropPx.width / 2 - half, top: cropPx.top - half,                                 cursor: 'ns-resize' },
    s:  { left: cropPx.left + cropPx.width / 2 - half, top: cropPx.top + cropPx.height - half,                 cursor: 'ns-resize' },
    e:  { left: cropPx.left + cropPx.width - half,     top: cropPx.top + cropPx.height / 2 - half,             cursor: 'ew-resize' },
    w:  { left: cropPx.left - half,                    top: cropPx.top + cropPx.height / 2 - half,             cursor: 'ew-resize' },
  };
  const p = positions[handle];

  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute bg-white border border-ink-700 rounded-sm hover:scale-110 transition-transform"
      style={{
        left: p.left,
        top: p.top,
        width: size,
        height: size,
        cursor: p.cursor,
        touchAction: 'none',
      }}
    />
  );
}

// ---- Geometry helpers ----

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function centeredCrop(W: number, H: number, ratio: number | null): CropRect {
  if (ratio == null) {
    // 80% of image, centered.
    const w = Math.round(W * 0.8);
    const h = Math.round(H * 0.8);
    return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
  }
  // Largest rect with given ratio that fits in 80% of image.
  const maxW = W * 0.8;
  const maxH = H * 0.8;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return {
    x: Math.round((W - w) / 2),
    y: Math.round((H - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  };
}

function snapToRatio(
  current: CropRect,
  ratio: number,
  W: number,
  H: number
): CropRect {
  // Keep the center, fit the largest rect of the given ratio inside current.
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  let w = current.w;
  let h = w / ratio;
  if (h > current.h) {
    h = current.h;
    w = h * ratio;
  }
  let x = cx - w / 2;
  let y = cy - h / 2;
  // Clamp to image bounds.
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > W) x = W - w;
  if (y + h > H) y = H - h;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

function applyResize(
  start: CropRect,
  handle: Extract<Drag, { kind: 'resize' }>['handle'],
  dx: number,
  dy: number,
  W: number,
  H: number,
  ratio: number | null
): CropRect {
  let { x, y, w, h } = start;

  // Apply the raw delta first.
  if (handle.includes('e')) w = start.w + dx;
  if (handle.includes('w')) { x = start.x + dx; w = start.w - dx; }
  if (handle.includes('s')) h = start.h + dy;
  if (handle.includes('n')) { y = start.y + dy; h = start.h - dy; }

  // Enforce ratio if locked — anchor to the side opposite the handle.
  if (ratio != null) {
    if (handle === 'e' || handle === 'w' || handle === 'n' || handle === 's') {
      // Edge drag in ratio mode — derive the other dim and re-center.
      if (handle === 'e' || handle === 'w') {
        h = w / ratio;
        y = start.y + (start.h - h) / 2;
      } else {
        w = h * ratio;
        x = start.x + (start.w - w) / 2;
      }
    } else {
      // Corner drag — pick whichever dim grew more, derive the other.
      if (Math.abs(dx) > Math.abs(dy)) {
        h = w / ratio;
        if (handle.includes('n')) y = start.y + start.h - h;
      } else {
        w = h * ratio;
        if (handle.includes('w')) x = start.x + start.w - w;
      }
    }
  }

  // Enforce minimum size.
  if (w < MIN_CROP_PX) {
    if (handle.includes('w')) x = start.x + start.w - MIN_CROP_PX;
    w = MIN_CROP_PX;
    if (ratio != null) h = w / ratio;
  }
  if (h < MIN_CROP_PX) {
    if (handle.includes('n')) y = start.y + start.h - MIN_CROP_PX;
    h = MIN_CROP_PX;
    if (ratio != null) w = h * ratio;
  }

  // Clamp to image bounds.
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > W) w = W - x;
  if (y + h > H) h = H - y;

  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
}

// ---- Crop pixel data → Blob ----

function cropToBlob(img: HTMLImageElement, c: CropRect, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = c.w;
    canvas.height = c.h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Crop export failed'))),
      mime || 'image/png',
      mime === 'image/jpeg' ? 0.95 : undefined
    );
  });
}
