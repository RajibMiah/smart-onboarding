/** Grabs a single frame from a video source (object URL or remote URL) as a PNG Blob, for clip thumbnails. */
export const captureVideoFrame = (src: string, atSeconds = 0.1): Promise<Blob> => {
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
        video.currentTime = Math.min(atSeconds, Math.max(0, video.duration - 0.05 || 0));
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
