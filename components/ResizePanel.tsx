'use client';

import { useState, useEffect } from 'react';
import {
  SIZE_PRESETS,
  MAX_DIMENSION,
  MIN_DIMENSION,
  toPixels,
  fromPixels,
  type Unit,
} from '@/lib/resizer';

interface ResizePanelProps {
  presetId: string;
  /** Always stored in PIXELS internally — units are a display-only concern. */
  customW: number;
  customH: number;
  originalW: number;
  originalH: number;
  onPresetChange: (id: string) => void;
  onCustomChange: (w: number, h: number) => void;
}

const UNITS: { id: Unit; label: string }[] = [
  { id: 'px', label: 'px' },
  { id: 'mm', label: 'mm' },
  { id: 'cm', label: 'cm' },
];

export default function ResizePanel({
  presetId,
  customW,
  customH,
  originalW,
  originalH,
  onPresetChange,
  onCustomChange,
}: ResizePanelProps) {
  const [unit, setUnit] = useState<Unit>('px');

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
                ? `${customW} × ${customH} px`
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
        <div className="space-y-3 pt-1">
          {/* Unit toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Unit</span>
            <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/10">
              {UNITS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUnit(u.id)}
                  className={`
                    px-2.5 py-1 rounded-md text-xs transition-colors
                    ${unit === u.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white'}
                  `}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* W / H inputs */}
          <div className="grid grid-cols-2 gap-3">
            <DimInput
              label="Width"
              valuePx={customW}
              unit={unit}
              onChangePx={(px) => onCustomChange(px, customH)}
            />
            <DimInput
              label="Height"
              valuePx={customH}
              unit={unit}
              onChangePx={(px) => onCustomChange(customW, px)}
            />
          </div>

          {unit !== 'px' && (
            <p className="text-[11px] text-white/40 leading-relaxed">
              Print sizes use 300 DPI &middot; current: {customW} × {customH} px
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DimInput({
  label,
  valuePx,
  unit,
  onChangePx,
}: {
  label: string;
  valuePx: number;
  unit: Unit;
  onChangePx: (px: number) => void;
}) {
  // Show the value in the user's chosen unit, but keep state in px.
  // Local string state lets users type "10.5" without the input snapping
  // back while they're mid-typing.
  const displayed = fromPixels(valuePx, unit);
  const [text, setText] = useState<string>(String(displayed));

  // Re-sync the input text whenever the px value changes from outside
  // (e.g. unit toggle, preset change, new image loaded).
  useEffect(() => {
    setText(String(fromPixels(valuePx, unit)));
  }, [valuePx, unit]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      // Invalid — revert.
      setText(String(fromPixels(valuePx, unit)));
      return;
    }
    onChangePx(toPixels(n, unit));
  };

  // Sensible step for each unit.
  const step = unit === 'px' ? 1 : 0.1;
  const min = unit === 'px' ? MIN_DIMENSION : 0.1;
  const max = unit === 'px' ? MAX_DIMENSION : fromPixels(MAX_DIMENSION, unit);

  return (
    <label className="block">
      <span className="text-xs text-white/50">{label}</span>
      <div className="flex items-center mt-1 bg-white/[0.04] border border-white/10 rounded-lg overflow-hidden">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="flex-1 bg-transparent px-3 py-2 text-sm tabular-nums focus:outline-none"
        />
        <span className="text-xs text-white/40 pr-3">{unit}</span>
      </div>
    </label>
  );
}
