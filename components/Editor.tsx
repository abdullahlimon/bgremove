'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Dropzone from './Dropzone';
import PreviewCanvas from './PreviewCanvas';
import BackgroundPanel from './BackgroundPanel';
import ResizePanel from './ResizePanel';
import ExportPanel from './ExportPanel';
import CropModal from './CropModal';

import { removeBackground } from '@/lib/bgRemoval';
import { composite, loadImage, type Background } from '@/lib/compositor';
import { resolveSize } from '@/lib/resizer';
import { canvasToBlob, downloadBlob, suggestedFilename, type ExportFormat } from '@/lib/exporter';
import { cleanupEdges } from '@/lib/edgeCleanup';

type Phase =
  | { kind: 'idle' }
  | { kind: 'processing'; message: string; percent: number }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

const DEFAULT_EDGE_CLEANUP = 1; // pixels — gentle by default

export default function Editor() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);

  // The "raw" foreground straight from the AI — we keep this around so the
  // edge-cleanup slider can re-process it from scratch each time without
  // compounding (cleanup is destructive).
  const [rawForeground, setRawForeground] = useState<HTMLImageElement | null>(null);
  // The cleaned-up version — what we actually composite onto backgrounds.
  const [foregroundImage, setForegroundImage] = useState<HTMLImageElement | null>(null);

  const [background, setBackground] = useState<Background>({ type: 'transparent' });
  const [customBgImage, setCustomBgImage] = useState<HTMLImageElement | null>(null);

  const [presetId, setPresetId] = useState<string>('original');
  const [customW, setCustomW] = useState<number>(1080);
  const [customH, setCustomH] = useState<number>(1080);

  const [edgeCleanup, setEdgeCleanup] = useState<number>(DEFAULT_EDGE_CLEANUP);
  const [cleanupBusy, setCleanupBusy] = useState<boolean>(false);

  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [exportBusy, setExportBusy] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);

  // ---- File picked → run AI ----
  const handleFileSelected = useCallback((file: File) => {
    setOriginalFile(file);
  }, []);

  // ---- Effect: When we have a file, run the AI ----
  useEffect(() => {
    if (!originalFile) return;
    let cancelled = false;

    const run = async () => {
      setPhase({ kind: 'processing', message: 'Loading model…', percent: 0 });
      try {
        const original = await loadImage(originalFile);
        if (cancelled) return;
        setOriginalImage(original);

        setCustomW(original.naturalWidth);
        setCustomH(original.naturalHeight);

        const fgBlob = await removeBackground(originalFile, {
          onProgress: (key, current, total) => {
            if (cancelled) return;
            const percent = total > 0 ? Math.round((current / total) * 100) : 0;
            const safeKey = typeof key === 'string' ? key : '';
            const message = safeKey.startsWith('fetch')
              ? `Loading model ${percent}%…`
              : safeKey.startsWith('compute')
                ? `Removing background ${percent}%…`
                : `Working ${percent}%…`;
            setPhase({ kind: 'processing', message, percent });
          },
        });
        if (cancelled) return;

        const rawFg = await loadImage(fgBlob);
        if (cancelled) return;
        setRawForeground(rawFg);
        // foregroundImage will be set by the cleanup effect below.
        setPhase({ kind: 'ready' });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        setPhase({ kind: 'error', message });
      }
    };

    run();
    return () => { cancelled = true; };
  }, [originalFile]);

  // ---- Effect: Apply edge cleanup whenever the slider or raw foreground changes ----
  // Debounced so dragging the slider doesn't lock up the page.
  const cleanupTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!rawForeground) return;

    if (cleanupTimer.current !== null) {
      clearTimeout(cleanupTimer.current);
    }

    // For amount=0, apply immediately (it's just a clone — fast).
    // For higher amounts, debounce to avoid running while the user is dragging.
    const delay = edgeCleanup === 0 ? 0 : 200;

    cleanupTimer.current = window.setTimeout(() => {
      let cancelled = false;

      const run = async () => {
        setCleanupBusy(true);
        try {
          const cleaned = await cleanupEdges(rawForeground, { amount: edgeCleanup });
          if (cancelled) return;
          setForegroundImage(cleaned);
        } catch {
          // If cleanup fails for any reason, fall back to the raw image.
          if (!cancelled) setForegroundImage(rawForeground);
        } finally {
          if (!cancelled) setCleanupBusy(false);
        }
      };

      run();
      return () => { cancelled = true; };
    }, delay);

    return () => {
      if (cleanupTimer.current !== null) clearTimeout(cleanupTimer.current);
    };
  }, [rawForeground, edgeCleanup]);

  // ---- Re-composite preview ----
  const PREVIEW_MAX = 1400;

  useEffect(() => {
    if (!foregroundImage || phase.kind !== 'ready') {
      setPreviewCanvas(null);
      return;
    }

    const target = resolveSize(
      presetId,
      customW,
      customH,
      foregroundImage.naturalWidth,
      foregroundImage.naturalHeight
    );

    const scale = Math.min(1, PREVIEW_MAX / Math.max(target.width, target.height));
    const previewW = Math.max(1, Math.round(target.width * scale));
    const previewH = Math.max(1, Math.round(target.height * scale));

    const bg = resolveBackgroundForRender(background, customBgImage, originalImage);

    const canvas = composite(foregroundImage, bg, previewW, previewH);
    setPreviewCanvas(canvas);
  }, [
    foregroundImage,
    background,
    customBgImage,
    originalImage,
    presetId,
    customW,
    customH,
    phase.kind,
  ]);

  // ---- Crop integration ----
  const handleCropApply = useCallback(async (croppedFile: File) => {
    setCropOpen(false);
    try {
      const fg = await loadImage(croppedFile);
      // Crop replaces the *raw* foreground — cleanup will re-apply automatically.
      setRawForeground(fg);
      setCustomW(fg.naturalWidth);
      setCustomH(fg.naturalHeight);
      setPresetId('original');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Crop failed.';
      setPhase({ kind: 'error', message });
    }
  }, []);

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
  }, []);

  const foregroundToFile = useCallback(async (): Promise<File | null> => {
    if (!foregroundImage) return null;
    const c = document.createElement('canvas');
    c.width = foregroundImage.naturalWidth;
    c.height = foregroundImage.naturalHeight;
    c.getContext('2d')!.drawImage(foregroundImage, 0, 0);
    const blob: Blob | null = await new Promise((resolve) =>
      c.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) return null;
    return new File([blob], 'foreground.png', { type: 'image/png' });
  }, [foregroundImage]);

  const handleOpenCrop = useCallback(async () => {
    const f = await foregroundToFile();
    if (f) {
      setCropSourceFile(f);
      setCropOpen(true);
    }
  }, [foregroundToFile]);

  const handlePickBgImage = useCallback(async (file: File) => {
    try {
      const img = await loadImage(file);
      setCustomBgImage(img);
      setBackground((prev) =>
        prev.type === 'image'
          ? { type: 'image', image: img, blur: prev.blur }
          : { type: 'image', image: img, blur: 0 }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load image.';
      setPhase({ kind: 'error', message });
    }
  }, []);

  const handleExport = useCallback(
    async (format: ExportFormat, quality: number) => {
      if (!foregroundImage) return;
      setExportBusy(true);
      try {
        const target = resolveSize(
          presetId,
          customW,
          customH,
          foregroundImage.naturalWidth,
          foregroundImage.naturalHeight
        );
        const bg = resolveBackgroundForRender(background, customBgImage, originalImage);
        const fullCanvas = composite(foregroundImage, bg, target.width, target.height);
        const blob = await canvasToBlob(fullCanvas, { format, quality });
        downloadBlob(blob, suggestedFilename(originalFile?.name, format));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed.';
        setPhase({ kind: 'error', message });
      } finally {
        setExportBusy(false);
      }
    },
    [foregroundImage, originalImage, originalFile, background, customBgImage, presetId, customW, customH]
  );

  const handleReset = useCallback(() => {
    setOriginalFile(null);
    setOriginalImage(null);
    setRawForeground(null);
    setForegroundImage(null);
    setCustomBgImage(null);
    setBackground({ type: 'transparent' });
    setPresetId('original');
    setEdgeCleanup(DEFAULT_EDGE_CLEANUP);
    setPreviewCanvas(null);
    setCropOpen(false);
    setCropSourceFile(null);
    setPhase({ kind: 'idle' });
  }, []);

  const showCheckerboard = background.type === 'transparent';
  const hasTransparency = background.type === 'transparent';

  // ---- Render ----
  if (phase.kind === 'idle') {
    return (
      <div className="px-4 py-12 sm:py-16">
        <Dropzone onFile={handleFileSelected} />
      </div>
    );
  }

  if (phase.kind === 'processing') {
    return <ProcessingScreen message={phase.message} percent={phase.percent} />;
  }

  if (phase.kind === 'error') {
    return (
      <div className="px-4 py-16 max-w-md mx-auto text-center">
        <p className="text-rose-400 mb-4">{phase.message}</p>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
        >
          Try another image
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="grid lg:grid-cols-[1fr_360px] gap-4 lg:gap-6 p-4 lg:p-6 min-h-[calc(100vh-72px)]">
        <div className="flex flex-col gap-3">
          <div className="flex-1 min-h-[320px]">
            <PreviewCanvas canvas={previewCanvas} showCheckerboard={showCheckerboard} />
          </div>
          <div className="flex justify-between items-center text-xs text-white/50">
            <span className="truncate max-w-[60%]">{originalFile?.name}</span>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white/80"
            >
              New image
            </button>
          </div>
        </div>

        <aside className="lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto thin-scroll
                          rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-6">
          {/* ---- Edit section: crop + edge cleanup ---- */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-white/50 font-medium">Edit</h2>

            <button
              onClick={handleOpenCrop}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/90 text-sm transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                <path d="M18 22V8a2 2 0 0 0-2-2H2" />
              </svg>
              Crop image
            </button>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">
                  Edge cleanup
                  {cleanupBusy && (
                    <span className="ml-2 text-white/40">working…</span>
                  )}
                </span>
                <span className="text-xs text-white/50 tabular-nums">
                  {edgeCleanup === 0 ? 'Off' : `${edgeCleanup}px`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={edgeCleanup}
                onChange={(e) => setEdgeCleanup(Number(e.target.value))}
                aria-label="Edge cleanup strength"
              />
              <p className="text-[11px] text-white/40 leading-relaxed">
                Removes dark fringe around subject. Increase if you see a halo.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10" />

          <BackgroundPanel
            background={background}
            onChange={setBackground}
            hasCustomImage={!!customBgImage}
            onPickImage={handlePickBgImage}
          />
          <div className="border-t border-white/10" />
          <ResizePanel
            presetId={presetId}
            customW={customW}
            customH={customH}
            originalW={foregroundImage?.naturalWidth ?? 0}
            originalH={foregroundImage?.naturalHeight ?? 0}
            onPresetChange={setPresetId}
            onCustomChange={(w, h) => { setCustomW(w); setCustomH(h); }}
          />
          <div className="border-t border-white/10" />
          <ExportPanel
            onExport={handleExport}
            busy={exportBusy}
            hasTransparency={hasTransparency}
          />
        </aside>
      </div>

      {cropOpen && cropSourceFile && (
        <CropModal
          file={cropSourceFile}
          onCrop={handleCropApply}
          onSkip={handleCropCancel}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}

function resolveBackgroundForRender(
  bg: Background,
  customBgImage: HTMLImageElement | null,
  originalImage: HTMLImageElement | null
): Background {
  if (bg.type === 'image') {
    if (customBgImage) return { type: 'image', image: customBgImage, blur: bg.blur ?? 0 };
    return { type: 'transparent' };
  }
  if (bg.type === 'blur') {
    if (originalImage) return { type: 'blur', original: originalImage, amount: bg.amount };
    return { type: 'transparent' };
  }
  return bg;
}

function ProcessingScreen({ message, percent }: { message: string; percent: number }) {
  return (
    <div className="px-4 py-16 max-w-md mx-auto text-center">
      <div className="inline-block w-12 h-12 mb-6">
        <svg viewBox="0 0 24 24" fill="none" className="animate-spin">
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
          <path
            d="M22 12a10 10 0 0 1-10 10"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="text-white/80 text-sm mb-3">{message}</p>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-200"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <p className="text-xs text-white/40 mt-4">
        First-time use downloads ~80 MB of model weights.<br />
        After that, it's instant.
      </p>
    </div>
  );
}
