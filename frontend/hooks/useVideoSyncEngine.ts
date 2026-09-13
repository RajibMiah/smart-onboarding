"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { ProjectMetadataPayload } from "@/types/project";
import type { ZoomRegion } from "@/types/zoom";

const DEFAULT_SPEED_MULTIPLIER = 2.0;

interface UseVideoSyncEngineResult {
  /** Mirrors the <video> element's own playhead, updated every animation frame. */
  currentTime: number;
  activeZoomRegion: ZoomRegion | null;
  /** CSS `transform` value for the video container — identity when no zoom region is active. */
  zoomTransform: string;
  /** Seeks the underlying element and resumes playback; safe to call before the element mounts. */
  seekTo: (timestamp: number) => void;
}

/**
 * Drives the Review page's non-destructive playback: every animation frame it
 * inspects the real `<video>` element's `currentTime` against the project's
 * `cuts` and `zoomRegions` and reacts —
 *
 * - a `cut` range jumps the playhead straight to its end, so the removed
 *   footage is skipped but the underlying media file is never touched;
 * - a `silence_speedup` range raises `playbackRate` for its duration and
 *   restores it to 1x outside any such range;
 * - a `ZoomRegion` produces a CSS transform for the caller to apply to the
 *   video's container, so the zoom is a pure compositor effect (hardware
 *   accelerated), not a re-render of any pixels.
 *
 * Blur/text overlays are intentionally not handled here — they don't affect
 * the video element itself, so `VideoReviewPlayer` derives them directly from
 * `currentTime` rather than routing them through this hook.
 */
export function useVideoSyncEngine(
  videoRef: RefObject<HTMLVideoElement | null>,
  project: Pick<ProjectMetadataPayload, "cuts" | "zoomRegions">,
): UseVideoSyncEngineResult {
  const [currentTime, setCurrentTime] = useState(0);
  const [activeZoomRegion, setActiveZoomRegion] = useState<ZoomRegion | null>(null);
  const frameRef = useRef(0);
  // Effects close over stale `project` on every render otherwise — this keeps
  // the single rAF loop below from having to restart every time cuts/zoom change.
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      const time = video.currentTime;
      const { cuts, zoomRegions } = projectRef.current;

      const activeCut = cuts.find((cut) => cut.type === "cut" && time >= cut.startTime && time < cut.endTime);
      if (activeCut) {
        video.currentTime = activeCut.endTime;
      }

      const activeSpeedup = cuts.find(
        (cut) => cut.type === "silence_speedup" && time >= cut.startTime && time < cut.endTime,
      );
      const targetRate = activeSpeedup ? (activeSpeedup.speedMultiplier ?? DEFAULT_SPEED_MULTIPLIER) : 1.0;
      if (Math.abs(video.playbackRate - targetRate) > 0.001) {
        video.playbackRate = targetRate;
      }

      const zoom = zoomRegions.find((region) => region.startTime <= time && time <= region.endTime) ?? null;
      setActiveZoomRegion((prev) => (prev?.id === zoom?.id ? prev : zoom));
      setCurrentTime(time);

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [videoRef]);

  // scale() then translate(): percentages in `translate()` resolve against the
  // element's own (unscaled) box, so this re-centers the region's midpoint on
  // the viewport *before* the scale blows it up — the same result as
  // transform-origin, expressed as scale+translate per the required contract.
  const zoomTransform = activeZoomRegion
    ? `scale(${activeZoomRegion.scale}) translate(${(0.5 - (activeZoomRegion.bounds.x + activeZoomRegion.bounds.width / 2)) * 100}%, ${(0.5 - (activeZoomRegion.bounds.y + activeZoomRegion.bounds.height / 2)) * 100}%)`
    : "scale(1) translate(0%, 0%)";

  const seekTo = useCallback(
    (timestamp: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = timestamp;
      video.play().catch(() => undefined);
    },
    [videoRef],
  );

  return { currentTime, activeZoomRegion, zoomTransform, seekTo };
}
