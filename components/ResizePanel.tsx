'use client';

import { useState, useEffect, useRef } from 'react';
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
  /** Always stored in PIXELS internally. */
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
  const [linked, setLinked] = useState<boolean>(false);

  // When the user enables the lock, capture the *current* aspect ratio at
  // that moment. From then on, any change to W or H scales the other dim
  // by this captured ratio. Capturing once (instead of computing
  // on-the-fly) avoids drift from successive rounding.
  const lockedRatio = useRef<number>(1);
  useEffect(() => {
    if (linked && customW > 0 && customH > 0) {
      lockedRatio.current = customW / customH;
    }
  }, [linked]); // intentionally only when toggled

  const handleWChange = (newW: number) => {
    if (linked && lockedRatio.current > 0) {
      const newH = Math.round(newW / lockedRatio.current);
      onCustomChange(newW, newH);
    } else {
      onCustomChange(newW, customH);
    }
  };

  const handleHChange = (newH: number) => {
    if (linked && lockedRatio.current > 0) {
      const newW = Math.round(newH * lockedRatio.current);
      onCustomChange(newW, newH);
    } else {
      onCustomChange(customW, newH);
    }
  };

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

          {/* W / H inputs with aspect-lock chain */}
          <div className="flex items-end gap-2">
            <DimInput
              label="Width"
              valuePx={customW}
              unit={unit}
              onChangePx={handleWChange}
            />

            <button
              onClick={() => setLinked((v) => !v)}
              className={`
                shrink-0 mb-1 w-9 h-9 rounded-lg border flex items-center justify-center transition-colors
                ${linked
                  ? 'border-accent bg-accent/15 text-white'
                  : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/90'}
              `}
              aria-label={linked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              title={linked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            >
              {linked ? <ChainLinkedIcon /> : <ChainUnlinkedIcon />}
            </button>

            <DimInput
              label="Height"
              valuePx={customH}
              unit={unit}
              onChangePx={handleHChange}
            />
          </div>

          <p className="text-[11px] text-white/40 leading-relaxed">
            {unit !== 'px' ? <>Print sizes use 300 DPI &middot; current: {customW} × {customH} px</> : <>&nbsp;</>}
          </p>
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
  const displayed = fromPixels(valuePx, unit);
  const [text, setText] = useState<string>(String(displayed));

  useEffect(() => {
    setText(String(fromPixels(valuePx, unit)));
  }, [valuePx, unit]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setText(String(fromPixels(valuePx, unit)));
      return;
    }
    onChangePx(toPixels(n, unit));
  };

  const step = unit === 'px' ? 1 : 0.1;
  const min = unit === 'px' ? MIN_DIMENSION : 0.1;
  const max = unit === 'px' ? MAX_DIMENSION : fromPixels(MAX_DIMENSION, unit);

  return (
    <label className="block flex-1 min-w-0">
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
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm tabular-nums focus:outline-none"
        />
        <span className="text-xs text-white/40 pr-3">{unit}</span>
      </div>
    </label>
  );
}

function ChainLinkedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ChainUnlinkedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07L11.78 5.18" />
      <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <line x1="2" y1="8" x2="5" y2="8" />
      <line x1="16" y1="22" x2="16" y2="19" />
      <line x1="22" y1="16" x2="19" y2="16" />
    </svg>
  );
}
