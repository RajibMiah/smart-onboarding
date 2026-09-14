import type { NextConfig } from "next";

/**
 * COOP/COEP are required for `SharedArrayBuffer`, which the multi-threaded
 * ffmpeg.wasm core (`@ffmpeg/core-mt`) needs to run. Without these headers
 * the browser silently falls back to a `SharedArrayBuffer`-less core (slower,
 * single-threaded) rather than failing — see `hooks/useFFmpegWasm.ts`.
 *
 * COEP is `credentialless`, not `require-corp`. Both make the page
 * `crossOriginIsolated` (what ffmpeg.wasm actually needs), but `require-corp`
 * additionally blocks any cross-origin subresource that doesn't send back a
 * `Cross-Origin-Resource-Policy`/CORS header — which every thumbnail/avatar
 * `<img>` pointing at the Django backend (a different port = a different
 * origin) or at an external URl (e.g. the seed data's picsum.photos images)
 * hits, since neither sends that header. `credentialless` instead loads such
 * a resource with credentials stripped, no header required — the right
 * trade-off here since none of those images need cookies to load anyway.
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
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
