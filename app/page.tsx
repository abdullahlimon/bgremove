import dynamic from 'next/dynamic';

// Editor uses browser-only APIs (Canvas, Web Workers, WASM). Disable SSR
// so Next doesn't try to render it on the server.
const Editor = dynamic(() => import('@/components/Editor'), { ssr: false });

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold text-white tracking-tight">Snipbg</span>
          <span className="hidden sm:inline text-xs text-white/40 ml-2">
            free background remover · runs in your browser
          </span>
        </div>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          source
        </a>
      </header>

      <div className="flex-1">
        <Editor />
      </div>

      <footer className="px-4 sm:px-6 py-4 border-t border-white/5 text-xs text-white/40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-2 justify-between">
          <span>Your images never leave your device.</span>
          <span>Powered by ONNX Runtime Web · MIT licensed.</span>
        </div>
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#g)" />
      <path
        d="M7 14.5L10 11.5L13 14.5L17 9.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="g" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}
