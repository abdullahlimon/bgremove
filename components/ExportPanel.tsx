'use client';

import { useState } from 'react';
import type { ExportFormat } from '@/lib/exporter';

interface ExportPanelProps {
  onExport: (format: ExportFormat, quality: number) => Promise<void>;
  /** Disable while busy. */
  busy?: boolean;
  /** True when the foreground has transparent areas — disables PNG-only message for JPG. */
  hasTransparency: boolean;
}

export default function ExportPanel({ onExport, busy, hasTransparency }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState<number>(95);

  return (
    <div className="space-y-4">
      <h2 className="text-xs uppercase tracking-wider text-white/50 font-medium">Export</h2>

      <div className="grid grid-cols-2 gap-2">
        <FormatButton
          active={format === 'png'}
          onClick={() => setFormat('png')}
          label="PNG"
          sub="Transparent"
        />
        <FormatButton
          active={format === 'jpg'}
          onClick={() => setFormat('jpg')}
          label="JPG"
          sub="Smaller file"
        />
      </div>

      {format === 'jpg' && (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/50">Quality</span>
            <span className="text-xs text-white/60 tabular-nums">{quality}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            aria-label="JPG quality"
          />
        </div>
      )}

      {format === 'jpg' && hasTransparency && (
        <p className="text-[11px] text-amber-300/80 leading-relaxed">
          JPG doesn't support transparency. Transparent areas will be filled with white.
          Use PNG to keep transparency.
        </p>
      )}

      <button
        onClick={() => onExport(format, quality / 100)}
        disabled={busy}
        className={`
          w-full py-3 rounded-xl font-medium text-sm transition-all
          ${busy
            ? 'bg-white/10 text-white/40 cursor-not-allowed'
            : 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-indigo-500/20'}
        `}
      >
        {busy ? 'Preparing…' : `Download ${format.toUpperCase()}`}
      </button>
    </div>
  );
}

function FormatButton({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        rounded-xl border p-3 text-left transition-colors
        ${active
          ? 'border-accent bg-accent/10 text-white'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-white/80'}
      `}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-white/50 mt-0.5">{sub}</div>
    </button>
  );
}
