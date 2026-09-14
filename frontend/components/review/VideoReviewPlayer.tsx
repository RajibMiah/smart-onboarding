"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import { useSafeVideoPlayback } from "@/hooks/useSafeVideoPlayback";
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
  /** Resume playback automatically once a *new* `project.primaryMediaUrl`
   *  becomes playable — the Theater's next/previous/select clip transitions.
   *  Never applies to this player's first source, so it never autoplays on
   *  its own when a page first opens. Review (a single, unchanging clip)
   *  leaves this off. */
  autoPlayOnChange?: boolean;
}

/**
 * The Review/Theater playback surface: a single real `<video>` plus
 * hardware-accelerated CSS layered on top, all driven by `useVideoSyncEngine`
 * from the live `currentTime` — cuts are skipped, silence is sped up, zoom
 * regions transform the frame, and blur/text overlays render in sync, all
 * non-destructively. No transcoding, no server round-trip, no re-render of
 * the source media itself. `useSafeVideoPlayback` owns switching the
 * underlying element cleanly between sources — Theater reuses this one
 * player instance across every clip in a playlist rather than remounting it.
 */
export const VideoReviewPlayer = forwardRef<VideoReviewPlayerHandle, VideoReviewPlayerProps>(
  ({ project, onEnded, autoPlayOnChange = false }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { currentTime, zoomTransform, seekTo } = useVideoSyncEngine(videoRef, project);
    const { isBuffering, hasError, errorDetail, retry } = useSafeVideoPlayback(videoRef, {
      src: project.primaryMediaUrl,
      autoPlayOnChange,
    });

    useImperativeHandle(ref, () => ({ seekTo, getElement: () => videoRef.current }), [seekTo]);

    const activeBlurRegions = project.blurRegions.filter(
      (region) => currentTime >= region.startTime && currentTime <= region.endTime,
    );
    const activeTextOverlays = project.textOverlays.filter(
      (region) => currentTime >= region.startTime && currentTime <= region.endTime,
    );

    return (
      <div className="relative aspect-video w-full overflow-hidden border border-black bg-black">
        {/* crossOrigin="use-credentials", not "anonymous": this src is
            served by a view that authenticates via the JWT cookie — "anonymous"
            mode deliberately omits credentials from a cross-origin request,
            which made every playback 404 as if no one were logged in, even
            with a fully valid session (the backend already sends the specific,
            non-wildcard Access-Control-Allow-Origin + Allow-Credentials
            headers credentialed CORS requires). */}
        <video
          ref={videoRef}
          // Omit `src` entirely rather than passing "" — an empty `src`
          // attribute is a valid (empty) URL reference that resolves to the
          // current page itself, so the browser would actually attempt to
          // decode this HTML document as a video instead of just having no source.
          src={project.primaryMediaUrl || undefined}
          controls
          crossOrigin="use-credentials"
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

        {!project.primaryMediaUrl ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="border border-neutral-500 bg-black px-3 py-1.5 font-mono text-[11px] font-semibold text-neutral-300">
              No video source for this clip.
            </span>
          </div>
        ) : hasError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
            <div className="max-w-sm border-2 border-black bg-rose-50 p-4 font-mono text-xs text-rose-800">
              <p className="font-bold">This video couldn&apos;t be loaded.</p>
              {errorDetail && <p className="mt-1">{errorDetail}</p>}
              <p className="mt-2 break-all text-[10px] text-rose-700/80">{project.primaryMediaUrl}</p>
              <button
                type="button"
                onClick={retry}
                className="mt-3 border border-black bg-white px-3 py-1.5 text-xs font-bold text-black transition hover:bg-neutral-100"
              >
                ↻ Retry Stream
              </button>
            </div>
          </div>
        ) : (
          isBuffering && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="border border-white bg-black px-3 py-1.5 font-mono text-[11px] font-semibold text-white">
                Buffering…
              </span>
            </div>
          )
        )}

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
  },
);
VideoReviewPlayer.displayName = "VideoReviewPlayer";
