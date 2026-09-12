/** Small browser-media helpers shared by the recorder and ffmpeg hooks. */

/**
 * Probes a video/audio object URL for its duration.
 *
 * Chrome reports `Infinity` for the duration of a freshly created
 * `MediaRecorder` webm blob until playback seeks past the real end at least
 * once (the file's duration/cues aren't finalized in the container) — so we
 * seek to a far-future time and read back the clamped, now-correct value.
 */
export function probeMediaDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.src = url;

    const cleanup = () => {
      el.removeAttribute("src");
      el.load();
    };

    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration)) {
        const duration = el.duration;
        cleanup();
        resolve(duration);
        return;
      }
      // Infinity-duration workaround.
      el.currentTime = 1e9;
      el.ontimeupdate = () => {
        el.ontimeupdate = null;
        const duration = Number.isFinite(el.duration) ? el.duration : 0;
        cleanup();
        resolve(duration);
      };
    };

    el.onerror = () => {
      cleanup();
      reject(new Error("Could not read media duration."));
    };
  });
}

/** Infers a container extension (without the dot) from a filename or URL. */
export function inferExtension(nameOrUrl: string, fallback = "webm"): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(nameOrUrl);
  return match ? match[1].toLowerCase() : fallback;
}

/** Formats seconds as `MM:SS.d` (matching the timeline's transport readout). */
export function formatTimecode(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const tenths = Math.floor((safe * 10) % 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
