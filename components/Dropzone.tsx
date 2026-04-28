'use client';

import { useCallback, useRef, useState } from 'react';

interface DropzoneProps {
  onFile: (file: File) => void;
  /** Disable the dropzone — used while the model is processing. */
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — plenty for ~6000×6000 photos.

export default function Dropzone({ onFile, disabled }: DropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Please upload a PNG, JPG, or WebP image.';
    }
    if (file.size > MAX_FILE_BYTES) {
      return `That image is over 25 MB. Try something smaller.`;
    }
    return null;
  };

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles, disabled]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const err = validate(file);
            if (err) {
              setError(err);
              return;
            }
            setError(null);
            onFile(file);
            return;
          }
        }
      }
    },
    [onFile, disabled]
  );

  return (
    <div
      onPaste={handlePaste}
      tabIndex={0}
      className="w-full max-w-2xl mx-auto"
    >
      <label
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center
          w-full min-h-[280px] sm:min-h-[340px]
          rounded-2xl border-2 border-dashed transition-all
          cursor-pointer select-none
          ${dragActive
            ? 'border-accent bg-accent/10'
            : 'border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04]'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <svg
          className="w-14 h-14 mb-4 text-white/60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>

        <p className="text-lg font-medium text-white">
          Drag &amp; drop an image
        </p>
        <p className="text-sm text-white/60 mt-1">
          or click to browse — paste also works
        </p>
        <p className="text-xs text-white/40 mt-4">
          PNG, JPG, or WebP &middot; up to 25 MB
        </p>
      </label>

      {error && (
        <p className="mt-3 text-sm text-rose-400 text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
