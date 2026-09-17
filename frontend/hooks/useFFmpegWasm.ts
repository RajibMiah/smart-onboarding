"use client";

import { useCallback, useEffect, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const CORE_VERSION = "0.12.10";
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/esm`;
// Must match the installed `@ffmpeg/ffmpeg` version (see package.json).
const FFMPEG_JS_VERSION = "0.12.15";
const FFMPEG_JS_BASE_URL = `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_JS_VERSION}/dist/esm`;

export interface TrimResult {
  blob: Blob;
  url: string;
}

export interface GenerateThumbnailsOptions {
  /** How many thumbnails to spread across the clip (default 10). */
  count?: number;
}

interface UseFFmpegWasmResult {
  isLoaded: boolean;
  isLoading: boolean;
  loadError: string | null;
  /** 0..1 progress of whatever ffmpeg operation is currently running. */
  progress: number;
  load: () => Promise<void>;
  generateThumbnails: (src: string, durationSeconds: number, options?: GenerateThumbnailsOptions) => Promise<string[]>;
  trimClip: (src: string, startSeconds: number, endSeconds: number, extension?: string) => Promise<TrimResult>;
  extractAudio: (src: string, extension?: string) => Promise<TrimResult>;
}

/**
 * Module-level singleton: ffmpeg.wasm's core is ~30MB and its worker can only
 * run one command at a time, so every call site — thumbnail generation, trim,
 * audio extraction, across every editor component — shares one loaded
 * instance and one serialized operation queue rather than each hook call
 * loading (and fighting over) its own.
 */
let sharedFFmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();
const progressListeners = new Set<(ratio: number) => void>();

/**
 * `@ffmpeg/ffmpeg`'s own wrapper worker (distinct from ffmpeg-core's
 * multi-threading worker) spawns itself via
 * `new Worker(new URL("./worker.js", import.meta.url))`. Two problems stack
 * here under Next.js/Turbopack:
 *
 * 1. Turbopack can't statically bundle that file — it contains its own
 *    `await import(url)` with a runtime-variable specifier, which trips
 *    Turbopack's static analysis ("Cannot find module as expression is too
 *    dynamic") when it tries to trace worker.js's dependency graph.
 * 2. Workers must be same-origin (or blob:/data:), so we can't just hand
 *    `classWorkerURL` the raw unpkg URL either — that throws a
 *    SecurityError.
 *
 * So we fetch worker.js's source as text (sidestepping Turbopack, which
 * never sees it) and inline its two tiny sibling ESM dependencies —
 * const.js and errors.js, both just a handful of constants — into one
 * self-contained blob, which *is* same-origin. Pinned to the exact
 * installed `@ffmpeg/ffmpeg` version so the inlining assumptions don't
 * silently drift out from under a dependency bump.
 */
const buildFFmpegWorkerBlobURL = async (): Promise<string> => {
  const [constSrc, errorsSrc, workerSrc] = await Promise.all(
    ["const.js", "errors.js", "worker.js"].map((file) =>
      fetch(`${FFMPEG_JS_BASE_URL}/${file}`).then((res) => res.text()),
    ),
  );

  const inlinedWorkerSrc = workerSrc
    .replace(/^import\s*\{[^}]*\}\s*from\s*["']\.\/const\.js["'];?\s*$/m, "")
    .replace(/^import\s*\{[^}]*\}\s*from\s*["']\.\/errors\.js["'];?\s*$/m, "");

  const combined = [constSrc, errorsSrc, inlinedWorkerSrc].join("\n");
  return URL.createObjectURL(new Blob([combined], { type: "text/javascript" }));
};

const loadSharedFFmpeg = async (): Promise<FFmpeg> => {
  if (sharedFFmpeg?.loaded) return sharedFFmpeg;
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        // ffmpeg occasionally reports progress slightly outside [0, 1].
        const ratio = Math.min(1, Math.max(0, progress));
        progressListeners.forEach((listener) => listener(ratio));
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
        workerURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.worker.js`, "text/javascript"),
        classWorkerURL: await buildFFmpegWorkerBlobURL(),
      });

      sharedFFmpeg = ffmpeg;
      return ffmpeg;
    })();
  }
  return loadPromise;
};

/** Runs `task` after every previously queued ffmpeg operation has settled. */
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const result = operationQueue.then(task, task);
  // Swallow rejections here so one failed op doesn't wedge the queue for
  // the next caller — the real error still reaches this call's own awaiter.
  operationQueue = result.catch(() => undefined);
  return result;
};

const toBlob = (data: Awaited<ReturnType<FFmpeg["readFile"]>>, mimeType: string): Blob => {
  const bytes = data as Uint8Array;
  return new Blob([new Uint8Array(bytes).buffer], { type: mimeType });
};

const CONTAINER_MIME: Record<string, string> = {
  webm: "video/webm",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

export const useFFmpegWasm = (): UseFFmpegWasmResult => {
  const [isLoaded, setIsLoaded] = useState(() => sharedFFmpeg?.loaded ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    progressListeners.add(setProgress);
    return () => {
      progressListeners.delete(setProgress);
    };
  }, []);

  const load = useCallback(async () => {
    if (sharedFFmpeg?.loaded) {
      setIsLoaded(true);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      await loadSharedFFmpeg();
      setIsLoaded(true);
    } catch {
      setLoadError("Could not load the in-browser video engine. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateThumbnails = useCallback(
    async (src: string, durationSeconds: number, options?: GenerateThumbnailsOptions): Promise<string[]> => {
      const count = options?.count ?? 10;
      const ffmpeg = await loadSharedFFmpeg();

      return enqueue(async () => {
        const inputPath = "thumb-input.webm";
        const intervalSeconds = Math.max(durationSeconds / count, 0.1);

        await ffmpeg.writeFile(inputPath, await fetchFile(src));
        await ffmpeg.exec([
          "-i", inputPath,
          "-vf", `fps=1/${intervalSeconds}`,
          "-vsync", "0",
          "-frames:v", String(count),
          "thumb_%03d.jpg",
        ]);

        const entries = await ffmpeg.listDir("/");
        const thumbFiles = entries
          .map((entry) => entry.name)
          .filter((name) => name.startsWith("thumb_") && name.endsWith(".jpg"))
          .sort();

        const urls: string[] = [];
        for (const fileName of thumbFiles) {
          const data = await ffmpeg.readFile(fileName);
          urls.push(URL.createObjectURL(toBlob(data, "image/jpeg")));
          await ffmpeg.deleteFile(fileName);
        }
        await ffmpeg.deleteFile(inputPath);

        return urls;
      });
    },
    [],
  );

  const trimClip = useCallback(
    async (src: string, startSeconds: number, endSeconds: number, extension = "webm"): Promise<TrimResult> => {
      const ffmpeg = await loadSharedFFmpeg();

      return enqueue(async () => {
        const inputPath = `trim-input.${extension}`;
        const outputPath = `trim-output.${extension}`;

        await ffmpeg.writeFile(inputPath, await fetchFile(src));
        // `-c copy` keeps this lossless and near-instant; the tradeoff (per
        // the ffmpeg.wasm/ffmpeg docs) is that cuts snap to the nearest
        // keyframe rather than the exact requested frame.
        await ffmpeg.exec([
          "-ss", String(startSeconds),
          "-to", String(endSeconds),
          "-i", inputPath,
          "-c", "copy",
          outputPath,
        ]);

        const data = await ffmpeg.readFile(outputPath);
        const blob = toBlob(data, CONTAINER_MIME[extension] ?? "video/webm");
        await ffmpeg.deleteFile(inputPath);
        await ffmpeg.deleteFile(outputPath);

        return { blob, url: URL.createObjectURL(blob) };
      });
    },
    [],
  );

  const extractAudio = useCallback(async (src: string, extension = "webm"): Promise<TrimResult> => {
    const ffmpeg = await loadSharedFFmpeg();

    return enqueue(async () => {
      const inputPath = `audio-input.${extension}`;
      const outputPath = `audio-output.${extension}`;

      await ffmpeg.writeFile(inputPath, await fetchFile(src));
      await ffmpeg.exec(["-i", inputPath, "-vn", "-acodec", "copy", outputPath]);

      const data = await ffmpeg.readFile(outputPath);
      const blob = toBlob(data, "audio/webm");
      await ffmpeg.deleteFile(inputPath);
      await ffmpeg.deleteFile(outputPath);

      return { blob, url: URL.createObjectURL(blob) };
    });
  }, []);

  return {
    isLoaded,
    isLoading,
    loadError,
    progress,
    load,
    generateThumbnails,
    trimClip,
    extractAudio,
  };
};
