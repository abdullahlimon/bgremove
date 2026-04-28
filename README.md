# Snipbg — Free Background Remover

A production-ready remove.bg clone that runs **entirely in the user's browser**.
No server, no API keys, no paid services. The AI model is downloaded once,
cached, and runs locally with WebAssembly.

## What it does

- Drag-and-drop image upload (PNG, JPG, WebP, up to 25 MB)
- Automatic background removal via on-device AI (no uploads to a server)
- Replace the background with a solid color, gradient, custom image, or blur
- Resize to Instagram post / story, Facebook cover, US passport, or custom dimensions
- Export as transparent PNG or high-quality JPG
- Fully mobile responsive

## Architecture, briefly

| Layer | Choice | Why |
|---|---|---|
| AI model | `@imgly/background-removal` (MIT) — ONNX Runtime Web running U²-Net | Free, MIT-licensed, runs in-browser. Zero server compute cost. |
| Framework | Next.js 14 + React + TypeScript | Static export works on any free host. TS catches bugs in image-pipeline code. |
| Styling | Tailwind CSS | No runtime cost, mobile-first. |
| Image pipeline | Native HTML Canvas API | Compositing, resizing, exporting — all native browser APIs, no extra deps. |
| Hosting | Vercel / Cloudflare Pages free tier | Instant global CDN, free forever for this use case. |

The single most important architectural choice: **the AI runs in the browser**,
not on a server. This is what makes the app genuinely free at any scale.

```
upload ──▶ in-browser AI ──▶ canvas compositing ──▶ download
            (~40 MB model,
             cached after
             first load)
```

A diagram of the full data flow is in the project's design notes.

## Getting started

You need Node.js 18.18+ or 20+.

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev

# 3. Open http://localhost:3000
```

The first time you process an image, the browser will download ~40 MB of model
weights. They're cached in IndexedDB for subsequent uses.

## Build for production

```bash
npm run build
npm start
```

This produces a self-contained Next.js build in `.next/`. For deployment,
see the next section.

## Deployment — choose one

All options below are 100% free for this app's traffic profile.

### Option A: Vercel (recommended — fastest path)

Vercel makes Next.js apps trivially simple to deploy.

1. Push the project to GitHub (or GitLab / Bitbucket).
2. Go to <https://vercel.com/new> and import the repo.
3. Vercel auto-detects Next.js — click "Deploy".

That's it. You'll get a `https://your-project.vercel.app` URL with a global
CDN, automatic HTTPS, and free SSL.

**Custom domain**: Vercel's free plan allows custom domains. Add one in the
project settings and update your DNS.

**Free tier limits**: 100 GB bandwidth/month and unlimited builds. For a
background-removal app, this is *way* more than you'll need (the only thing
served from the server is the static frontend ~ a few MB; the model weights
themselves are served from a CDN by the @imgly library).

### Option B: Cloudflare Pages

Cloudflare Pages also has a generous free tier and is excellent for static apps.

1. Push to GitHub.
2. Go to <https://dash.cloudflare.com/?to=/:account/pages>.
3. Create a project, connect your repo, and use these build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
   - **Framework preset**: Next.js
4. Deploy.

Cloudflare's free tier includes unlimited bandwidth, which beats Vercel for
heavy-traffic projects.

> **Note on COOP/COEP headers**: This app sets the `Cross-Origin-Opener-Policy`
> and `Cross-Origin-Embedder-Policy` headers in `next.config.mjs` to enable
> `SharedArrayBuffer` for faster multi-threaded WebAssembly. Both Vercel and
> Cloudflare Pages respect these headers. If you self-host, make sure your
> reverse proxy / CDN preserves them.

### Option C: Self-host on any static host

Because Next.js can be statically exported and the app has no server-side
logic, you can also deploy to:

- GitHub Pages (free)
- Netlify (free tier, 100 GB bandwidth)
- Render's static sites (free)
- Any object storage with CDN (S3, R2, etc.)

For a static export, change `next.config.mjs` to add `output: 'export'`, then
`npm run build` will generate an `out/` folder you can upload anywhere.
Note that static export **disables custom headers**, which means you'll lose
the COOP/COEP optimization (the app will still work, just slightly slower).

## Configuration

There are no environment variables. The app is fully self-contained.

### Tunable bits inside the code

- **Model quality** — `lib/bgRemoval.ts` exposes a `quality` option
  (`'low' | 'medium' | 'high'`). Defaults to medium. High uses the full-precision
  ISNet model (~170 MB) for slightly better edges; medium uses the FP16-quantized
  version (~40 MB).
- **Maximum upload size** — `components/Dropzone.tsx`, `MAX_FILE_BYTES`. Default 25 MB.
- **Preview resolution** — `components/Editor.tsx`, `PREVIEW_MAX`. Default 1400 px on
  the longest side. Exports always use the full target size regardless.
- **Resize presets** — `lib/resizer.ts`, `SIZE_PRESETS`. Add more as needed.

## Troubleshooting

**"The model takes forever to load"**
First-time use downloads ~40 MB. After that it's cached in IndexedDB. If you're
on a slow connection, expect 30–60 seconds the first time. If it's *still* slow
on a second visit, your browser may have evicted the cache (Safari is
aggressive about this in private mode).

**"It crashes on my old phone"**
The model needs ~500 MB of RAM during inference. Older mobile devices with
< 2 GB RAM may run out of memory on large images. Recommend desktop or a
newer phone.

**"My passport photo isn't quite right"**
The "Passport (US 2×2)" preset is sized for the US standard. Other countries
have different requirements (UK is 35×45 mm at 600 dpi, etc.) — use **Custom**
to set exact dimensions.

**"Edges look rough on hair"**
Browser-based U²-Net is excellent for most images but isn't quite at the
quality of paid commercial models on extreme detail like wispy hair. If you
need that, consider self-hosting a Hugging Face Space with a higher-end
model — the architecture is designed so you can swap `lib/bgRemoval.ts` to
call a remote endpoint without changing any UI code.

## Project structure

```
bgremover/
├── app/
│   ├── layout.tsx              # Root layout, metadata
│   ├── page.tsx                # Top-level page
│   └── globals.css             # Tailwind + custom CSS
├── components/
│   ├── Dropzone.tsx            # Drag-and-drop upload
│   ├── Editor.tsx              # Orchestrator (state + pipeline)
│   ├── PreviewCanvas.tsx       # Before/after preview
│   ├── BackgroundPanel.tsx     # Solid / gradient / image / blur
│   ├── ResizePanel.tsx         # Preset sizes + custom dimensions
│   └── ExportPanel.tsx         # PNG/JPG download
├── lib/
│   ├── bgRemoval.ts            # AI model wrapper
│   ├── compositor.ts           # Canvas compositing
│   ├── resizer.ts              # Resize presets + math
│   └── exporter.ts             # PNG/JPG export
├── public/                     # (favicon, og image — add your own)
├── next.config.mjs             # COOP/COEP headers, webpack tweaks
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## License

MIT — do whatever you want with this code.

The AI model (`@imgly/background-removal`) is also MIT-licensed.
