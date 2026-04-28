/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The @imgly/background-removal library uses WebAssembly + Web Workers.
  // Some browsers require these COOP/COEP headers to enable SharedArrayBuffer,
  // which gives us multi-threaded WASM and ~2-3x faster inference.
  //
  // We use `credentialless` instead of `require-corp` because the model weights
  // are fetched from a third-party CDN — `credentialless` lets cross-origin
  // requests succeed without the CDN needing to opt in via CORP headers.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },

  // Don't bundle the AI libs into the server build — they're browser-only and
  // contain import.meta which webpack's CJS parser can't handle. Since the
  // Editor component is loaded with `ssr: false`, the server never needs them.
  experimental: {
    serverComponentsExternalPackages: [
      'onnxruntime-web',
      '@imgly/background-removal',
    ],
  },

  webpack: (config, { isServer }) => {
    // Treat .mjs files in node_modules as ESM (the default in webpack 5 is
    // strict; this loosens it so ONNX Runtime's bootstrap file parses).
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: { fullySpecified: false },
    });

    // Browser-only fallbacks — these libs reference Node built-ins that
    // don't exist in the browser.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Belt-and-suspenders: also mark them external on the server side.
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('onnxruntime-web', '@imgly/background-removal');
    }

    return config;
  },
};

export default nextConfig;
