"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import { useVideoSyncEngine } from "@/hooks/useVideoSyncEngine";
import type { ProjectMetadataPayload } from "@/types/project";

export interface VideoReviewPlayerHandle {
  /** Exposed to `AppliedEditsSummary` so clicking an edit jumps the preview straight to it. */
  seekTo: (timestamp: number) => void;
  /** Escape hatch for callers that need native controls this handle doesn't
   *  wrap directly — e.g. the Theater's playback-speed selector and ±5s jump. */
  getElement: () => HTMLVideoElement | null;
}

interface VideoReviewPlayerProps {
  project: ProjectMetadataPayload;
  /** Fires when the underlying <video> reaches its end — drives the Theater's auto-advance. */
  onEnded?: () => void;
}

/**
 * The Review page's actual playback surface: a single real `<video>` plus
 * hardware-accelerated CSS layered on top, all driven by `useVideoSyncEngine`
 * from the live `currentTime` — cuts are skipped, silence is sped up, zoom
 * regions transform the frame, and blur/text overlays render in sync, all
 * non-destructively. No transcoding, no server round-trip, no re-render of
 * the source media itself.
 */
export const VideoReviewPlayer = forwardRef<VideoReviewPlayerHandle, VideoReviewPlayerProps>(({ project, onEnded }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentTime, zoomTransform, seekTo } = useVideoSyncEngine(videoRef, project);

  useImperativeHandle(ref, () => ({ seekTo, getElement: () => videoRef.current }), [seekTo]);

  const activeBlurRegions = project.blurRegions.filter(
    (region) => currentTime >= region.startTime && currentTime <= region.endTime,
  );
  const activeTextOverlays = project.textOverlays.filter(
    (region) => currentTime >= region.startTime && currentTime <= region.endTime,
  );

  return (
    <div className="relative aspect-video w-full overflow-hidden border border-black bg-black">
      {/* crossOrigin: a resumed clip's src is backend-hosted (cross-origin
          relative to this app), and the COEP require-corp policy (next.config.ts,
          for ffmpeg.wasm) silently blocks a cross-origin media load that isn't
          fetched in CORS mode — the backend already sends valid CORS headers. */}
      <video
        ref={videoRef}
        src={project.primaryMediaUrl}
        controls
        crossOrigin="anonymous"
        onEnded={onEnded}
        className="h-full w-full origin-center object-contain duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform"
        style={{
          filter: `brightness(${project.filters.brightness}%) contrast(${project.filters.contrast}%) saturate(${project.filters.saturation}%)`,
          transform: zoomTransform,
          transitionProperty: "transform",
        }}
      >
        <track kind="captions" />
      </video>

      {activeBlurRegions.map((region) => (
        <div
          key={region.id}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: `${region.bounds.x * 100}%`,
            top: `${region.bounds.y * 100}%`,
            width: `${region.bounds.width * 100}%`,
            height: `${region.bounds.height * 100}%`,
            backdropFilter: `blur(${region.blurRadius}px)`,
            WebkitBackdropFilter: `blur(${region.blurRadius}px)`,
            borderRadius: region.shape === "ellipse" ? "9999px" : undefined,
          }}
        />
      ))}

      {activeTextOverlays.map((region) => (
        <div
          key={region.id}
          className="pointer-events-none absolute whitespace-pre-wrap px-2 py-1"
          style={{
            left: `${region.bounds.x * 100}%`,
            top: `${region.bounds.y * 100}%`,
            width: `${region.bounds.width * 100}%`,
            fontSize: region.style.fontSize,
            fontWeight: region.style.fontWeight,
            color: region.style.textColor,
            backgroundColor: region.style.backgroundColor || undefined,
            textAlign: region.style.textAlign,
          }}
        >
          {region.content}
        </div>
      ))}
    </div>
  );
});
VideoReviewPlayer.displayName = "VideoReviewPlayer";
