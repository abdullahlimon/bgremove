'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dropzone from './Dropzone';
import PreviewCanvas from './PreviewCanvas';
import BackgroundPanel from './BackgroundPanel';
import ResizePanel from './ResizePanel';
import ExportPanel from './ExportPanel';

import { removeBackground } from '@/lib/bgRemoval';
import { composite, loadImage, type Background } from '@/lib/compositor';
import { resolveSize } from '@/lib/resizer';
import { canvasToBlob, downloadBlob, suggestedFilename, type ExportFormat } from '@/lib/exporter';

type Phase =
  | { kind: 'idle' }
  | { kind: 'processing'; message: string; percent: number }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

export default function Editor() {
  // The original image (raw upload), the original-as-loaded HTMLImageElement,
  // and the foreground (background-removed PNG) as an HTMLImageElement.
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [foregroundImage, setForegroundImage] = useState<HTMLImageElement | null>(null);

  // Background config — defaults to transparent so the user immediately
  // sees "background removed" once processing finishes.
  const [background, setBackground] = useState<Background>({ type: 'transparent' });
  const [customBgImage, setCustomBgImage] = useState<HTMLImageElement | null>(null);

  // Resize config.
  const [presetId, setPresetId] = useState<string>('original');
  const [customW, setCustomW] = useState<number>(1080);
  const [customH, setCustomH] = useState<number>(1080);

  // The current preview canvas — re-built whenever inputs change.
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [exportBusy, setExportBusy] = useState(false);

  // ---- Effect: Run AI background removal whenever a new file is loaded ----
  useEffect(() => {
    if (!originalFile) return;
    let cancelled = false;

    const run = async () => {
      setPhase({ kind: 'processing', message: 'Loading model…', percent: 0 });
      try {
        // Load the original into an HTMLImageElement (used by the blur-bg option).
        const original = await loadImage(originalFile);
        if (cancelled) return;
        setOriginalImage(original);

        // Default custom dimensions to the original size.
        setCustomW(original.naturalWidth);
        setCustomH(original.naturalHeight);

        // Run the AI model.
        const fgBlob = await removeBackground(originalFile, {
          onProgress: (key, current, total) => {
            if (cancelled) return;
            const percent = total > 0 ? Math.round((current / total) * 100) : 0;
            // The library reports phases like 'fetch:model.onnx' — keep messages friendly.
            const message = key.startsWith('fetch')
              ? `Loading model ${percent}%…`
              : key.startsWith('compute')
                ? `Removing background ${percent}%…`
                : `Working ${percent}%…`;
            setPhase({ kind: 'processing', message, percent });
          },
        });
        if (cancelled) return;

        const fg = await loadImage(fgBlob);
        if (cancelled) return;
        setForegroundImage(fg);
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

  // ---- Effect: Re-composite the preview whenever inputs change ----
  // We use a *display* canvas (smaller) for live preview to keep things smooth,
  // and only compose at full resolution when the user actually exports.
  const PREVIEW_MAX = 1400;

  useEffect(() => {
    if (!foregroundImage || phase.kind !== 'ready') {
      setPreviewCanvas(null);
      return;
    }

    // Resolve the *target* size (from preset or custom).
    const target = resolveSize(
      presetId,
      customW,
      customH,
      foregroundImage.naturalWidth,
      foregroundImage.naturalHeight
    );

    // Scale preview down for performance — exports use the full size.
    const scale = Math.min(1, PREVIEW_MAX / Math.max(target.width, target.height));
    const previewW = Math.max(1, Math.round(target.width * scale));
    const previewH = Math.max(1, Math.round(target.height * scale));

    // Build the actual background object the compositor uses.
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

  // ---- Handler: pick a custom background image ----
  const handlePickBgImage = useCallback(async (file: File) => {
    try {
      const img = await loadImage(file);
      setCustomBgImage(img);
      // Auto-switch to "image" mode if user wasn't already there.
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

  // ---- Handler: export ----
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

  // ---- Handler: reset / new image ----
  const handleReset = useCallback(() => {
    setOriginalFile(null);
    setOriginalImage(null);
    setForegroundImage(null);
    setCustomBgImage(null);
    setBackground({ type: 'transparent' });
    setPresetId('original');
    setPreviewCanvas(null);
    setPhase({ kind: 'idle' });
  }, []);

  const showCheckerboard = background.type === 'transparent';
  const hasTransparency = background.type === 'transparent';

  // ---- Render ----
  if (!originalFile || phase.kind === 'idle') {
    return (
      <div className="px-4 py-12 sm:py-16">
        <Dropzone onFile={setOriginalFile} />
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
    <div className="grid lg:grid-cols-[1fr_360px] gap-4 lg:gap-6 p-4 lg:p-6 min-h-[calc(100vh-72px)]">
      {/* Preview area */}
      <div className="flex flex-col gap-3">
        <div className="flex-1 min-h-[320px]">
          <PreviewCanvas canvas={previewCanvas} showCheckerboard={showCheckerboard} />
        </div>
        <div className="flex justify-between items-center text-xs text-white/50">
          <span>{originalFile.name}</span>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white/80"
          >
            New image
          </button>
        </div>
      </div>

      {/* Control panel */}
      <aside className="lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto thin-scroll
                        rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-6">
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
  );
}

/**
 * Translate the user's chosen background into the form the compositor wants.
 * In particular, "blur" needs the *original* image (not the foreground).
 */
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
        First-time use downloads ~40 MB of model weights.<br />
        After that, it's instant.
      </p>
    </div>
  );
}
