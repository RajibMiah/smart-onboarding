import { cssFilterString, type TimelineCut, type VideoFilterSettings } from "@/types/project";

/** The first timestamp a viewer actually sees — skips past any leading `cut`
 *  range instead of always capturing raw source time `atSeconds`, which
 *  could land inside footage the edit already removed. */
const firstVisibleTimestamp = (atSeconds: number, cuts: TimelineCut[]): number => {
  const leadingCut = cuts
    .filter((cut) => cut.type === "cut" && cut.startTime <= atSeconds && atSeconds < cut.endTime)
    .sort((a, b) => b.endTime - a.endTime)[0];
  return leadingCut ? leadingCut.endTime + 0.05 : atSeconds;
};

/** Grabs a single frame from a video source (object URL or remote URL) as a
 *  PNG Blob, for clip thumbnails. Optionally skips past leading cuts and
 *  bakes in the project's live filter adjustments, so the thumbnail matches
 *  what the edited clip actually looks/starts like rather than raw frame 0. */
export const captureVideoFrame = (
  src: string,
  atSeconds = 0.1,
  options?: { cuts?: TimelineCut[]; filters?: VideoFilterSettings },
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = src;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener(
      "loadedmetadata",
      () => {
        const target = firstVisibleTimestamp(atSeconds, options?.cuts ?? []);
        video.currentTime = Math.min(target, Math.max(0, video.duration - 0.05 || 0));
      },
      { once: true },
    );

    video.addEventListener(
      "seeked",
      () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        if (options?.filters) ctx.filter = cssFilterString(options.filters);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          cleanup();
          if (blob) resolve(blob);
          else reject(new Error("Failed to encode thumbnail"));
        }, "image/png");
      },
      { once: true },
    );

    video.addEventListener(
      "error",
      () => {
        cleanup();
        reject(new Error("Failed to load video for thumbnail capture"));
      },
      { once: true },
    );
  });
};
