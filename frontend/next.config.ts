import type { NextConfig } from "next";

/**
 * COOP/COEP are required for `SharedArrayBuffer`, which the multi-threaded
 * ffmpeg.wasm core (`@ffmpeg/core-mt`) needs to run. Without these headers
 * the browser silently falls back to a `SharedArrayBuffer`-less core (slower,
 * single-threaded) rather than failing — see `hooks/useFFmpegWasm.ts`.
 */
const nextConfig: NextConfig = {
  // Traces only the dependencies each route actually needs into
  // `.next/standalone` — the Dockerfile copies just that, not all of
  // node_modules, for a much smaller production image.
  output: "standalone",

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
