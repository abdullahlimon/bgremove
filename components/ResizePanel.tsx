'use client';

import { SIZE_PRESETS, MAX_DIMENSION, MIN_DIMENSION } from '@/lib/resizer';

interface ResizePanelProps {
  presetId: string;
  customW: number;
  customH: number;
  originalW: number;
  originalH: number;
  onPresetChange: (id: string) => void;
  onCustomChange: (w: number, h: number) => void;
}

export default function ResizePanel({
  presetId,
  customW,
  customH,
  originalW,
  originalH,
  onPresetChange,
  onCustomChange,
}: ResizePanelProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs uppercase tracking-wider text-white/50 font-medium">Resize</h2>

      <div className="grid grid-cols-2 gap-2">
        {SIZE_PRESETS.map((p) => {
          const isActive = p.id === presetId;
          const dimensionLabel =
            p.id === 'original'
              ? originalW && originalH ? `${originalW} × ${originalH}` : ''
              : p.id === 'custom'
                ? `${customW} × ${customH}`
                : `${p.width} × ${p.height}`;
          return (
            <button
              key={p.id}
              onClick={() => onPresetChange(p.id)}
              className={`
                text-left rounded-xl border p-3 transition-colors
                ${isActive
                  ? 'border-accent bg-accent/10 text-white'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-white/80'}
              `}
            >
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-[11px] text-white/50 mt-0.5">
                {dimensionLabel || p.hint}
              </div>
            </button>
          );
        })}
      </div>

      {presetId === 'custom' && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <DimInput
            label="Width"
            value={customW}
            onChange={(v) => onCustomChange(v, customH)}
          />
          <DimInput
            label="Height"
            value={customH}
            onChange={(v) => onCustomChange(customW, v)}
          />
        </div>
      )}
    </div>
  );
}

function DimInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-white/50">{label}</span>
      <div className="flex items-center mt-1 bg-white/[0.04] border border-white/10 rounded-lg overflow-hidden">
        <input
          type="number"
          min={MIN_DIMENSION}
          max={MAX_DIMENSION}
          value={value}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (Number.isFinite(n)) onChange(n);
          }}
          className="flex-1 bg-transparent px-3 py-2 text-sm tabular-nums focus:outline-none"
        />
        <span className="text-xs text-white/40 pr-3">px</span>
      </div>
    </label>
  );
}
