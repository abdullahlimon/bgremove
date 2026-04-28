'use client';

import { useRef } from 'react';
import type { Background } from '@/lib/compositor';

interface BackgroundPanelProps {
  background: Background;
  onChange: (bg: Background) => void;
  /** Whether the user has loaded a custom image as the background. */
  hasCustomImage: boolean;
  /** Called when user picks a file to use as background. */
  onPickImage: (file: File) => void;
}

type Tab = 'transparent' | 'solid' | 'gradient' | 'image' | 'blur';

const QUICK_COLORS = [
  '#ffffff', '#f3f4f6', '#0b0b10', '#111827',
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#6366f1', '#a855f7', '#ec4899', '#14b8a6',
];

const GRADIENT_PRESETS: Array<[string, string]> = [
  ['#6366f1', '#ec4899'],
  ['#3b82f6', '#10b981'],
  ['#f59e0b', '#ef4444'],
  ['#0ea5e9', '#a855f7'],
  ['#0b0b10', '#3f3f48'],
  ['#fef3c7', '#fce7f3'],
];

export default function BackgroundPanel({
  background,
  onChange,
  hasCustomImage,
  onPickImage,
}: BackgroundPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const tab = background.type as Tab;

  return (
    <div className="space-y-4">
      <SectionTitle>Background</SectionTitle>

      <TabRow
        active={tab}
        onChange={(next) => {
          // When switching tabs, set sensible defaults for the new type.
          if (next === 'transparent') onChange({ type: 'transparent' });
          else if (next === 'solid')  onChange({ type: 'solid', color: '#ffffff' });
          else if (next === 'gradient') onChange({ type: 'gradient', from: '#6366f1', to: '#ec4899', angle: 135 });
          else if (next === 'image')   fileRef.current?.click();
          else if (next === 'blur')    onChange({ type: 'blur', original: null, amount: 24 });
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickImage(file);
          // Allow re-picking the same file later.
          e.target.value = '';
        }}
      />

      {tab === 'solid' && background.type === 'solid' && (
        <SolidControls color={background.color} onChange={(color) => onChange({ type: 'solid', color })} />
      )}

      {tab === 'gradient' && background.type === 'gradient' && (
        <GradientControls bg={background} onChange={onChange} />
      )}

      {tab === 'image' && background.type === 'image' && (
        <ImageControls
          hasImage={hasCustomImage}
          blur={background.blur ?? 0}
          onBlurChange={(blur) => onChange({ ...background, blur })}
          onPickAgain={() => fileRef.current?.click()}
        />
      )}

      {tab === 'blur' && background.type === 'blur' && (
        <BlurControls amount={background.amount} onChange={(amount) => onChange({ ...background, amount })} />
      )}

      {tab === 'transparent' && (
        <p className="text-xs text-white/50">
          Transparent background. Export as PNG to keep it transparent — JPG will fall back to white.
        </p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-wider text-white/50 font-medium">{children}</h2>;
}

function TabRow({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'transparent', label: 'None' },
    { id: 'solid',       label: 'Color' },
    { id: 'gradient',    label: 'Gradient' },
    { id: 'image',       label: 'Image' },
    { id: 'blur',        label: 'Blur' },
  ];
  return (
    <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`
            text-xs sm:text-sm py-2 px-1 rounded-lg transition-colors
            ${active === t.id
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}
          `}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SolidControls({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 rounded-lg"
          aria-label="Background color"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
          aria-label="Color hex value"
        />
      </div>
      <div className="grid grid-cols-6 gap-2">
        {QUICK_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="aspect-square rounded-lg border border-white/15 hover:scale-105 transition-transform"
            style={{ background: c }}
            aria-label={`Pick ${c}`}
          />
        ))}
      </div>
    </div>
  );
}

function GradientControls({
  bg,
  onChange,
}: {
  bg: Extract<Background, { type: 'gradient' }>;
  onChange: (bg: Background) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={bg.from}
          onChange={(e) => onChange({ ...bg, from: e.target.value })}
          className="w-10 h-10 rounded-lg"
          aria-label="Gradient start color"
        />
        <span className="text-white/40 text-xs">to</span>
        <input
          type="color"
          value={bg.to}
          onChange={(e) => onChange({ ...bg, to: e.target.value })}
          className="w-10 h-10 rounded-lg"
          aria-label="Gradient end color"
        />
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-white/50 whitespace-nowrap">Angle</span>
          <input
            type="range"
            min={0}
            max={360}
            value={bg.angle}
            onChange={(e) => onChange({ ...bg, angle: Number(e.target.value) })}
            aria-label="Gradient angle"
          />
          <span className="text-xs text-white/60 w-10 text-right tabular-nums">{bg.angle}°</span>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {GRADIENT_PRESETS.map(([from, to]) => (
          <button
            key={`${from}-${to}`}
            onClick={() => onChange({ ...bg, from, to })}
            className="aspect-square rounded-lg border border-white/15 hover:scale-105 transition-transform"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            aria-label="Gradient preset"
          />
        ))}
      </div>
    </div>
  );
}

function ImageControls({
  hasImage,
  blur,
  onBlurChange,
  onPickAgain,
}: {
  hasImage: boolean;
  blur: number;
  onBlurChange: (n: number) => void;
  onPickAgain: () => void;
}) {
  return (
    <div className="space-y-3">
      {!hasImage && (
        <p className="text-xs text-white/50">
          Loading image…
        </p>
      )}
      <button
        onClick={onPickAgain}
        className="w-full text-sm py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
      >
        Choose a different image
      </button>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/50">Blur</span>
          <span className="text-xs text-white/60 tabular-nums">{blur}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={40}
          value={blur}
          onChange={(e) => onBlurChange(Number(e.target.value))}
          aria-label="Background blur"
        />
      </div>
    </div>
  );
}

function BlurControls({ amount, onChange }: { amount: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/50">
        Use the original photo as a blurred backdrop — popular for portraits and product shots.
      </p>
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/50">Blur amount</span>
        <span className="text-xs text-white/60 tabular-nums">{amount}px</span>
      </div>
      <input
        type="range"
        min={4}
        max={60}
        value={amount}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Blur amount"
      />
    </div>
  );
}
