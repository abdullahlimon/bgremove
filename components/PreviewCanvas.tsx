'use client';

import { useEffect, useRef } from 'react';

interface PreviewCanvasProps {
  /**
   * The fully composited canvas to display. Component clones it into its
   * own canvas sized to fit the viewport — keeps memory predictable and
   * avoids stretching when the source canvas is bigger than the screen.
   */
  canvas: HTMLCanvasElement | null;
  /** Show the checkerboard backdrop (i.e. the foreground has transparency). */
  showCheckerboard: boolean;
}

export default function PreviewCanvas({ canvas, showCheckerboard }: PreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas || !displayRef.current || !containerRef.current) return;

    const display = displayRef.current;
    const container = containerRef.current;
    const ctx = display.getContext('2d')!;

    const draw = () => {
      const containerW = container.clientWidth;
      const containerH = container.clientHeight;
      if (containerW <= 0 || containerH <= 0) return;

      // Account for device pixel ratio so the preview is crisp on retina.
      const dpr = window.devicePixelRatio || 1;

      // Fit the source canvas into the container, preserving aspect ratio.
      const ar = canvas.width / canvas.height;
      let w = containerW;
      let h = w / ar;
      if (h > containerH) {
        h = containerH;
        w = h * ar;
      }

      display.width = Math.round(w * dpr);
      display.height = Math.round(h * dpr);
      display.style.width = `${w}px`;
      display.style.height = `${h}px`;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, display.width, display.height);
      ctx.drawImage(canvas, 0, 0, display.width, display.height);
    };

    draw();

    // Re-draw on resize so the preview scales with the window.
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [canvas]);

  return (
    <div
      ref={containerRef}
      className={`
        relative w-full h-full min-h-[300px] sm:min-h-[420px]
        rounded-2xl overflow-hidden flex items-center justify-center
        ${showCheckerboard ? 'checker' : 'bg-ink-800'}
      `}
    >
      {canvas ? (
        <canvas ref={displayRef} aria-label="Image preview" />
      ) : (
        <p className="text-white/40 text-sm">Preview will appear here</p>
      )}
    </div>
  );
}
