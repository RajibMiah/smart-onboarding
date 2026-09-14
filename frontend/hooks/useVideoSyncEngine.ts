"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { computeZoomTransform } from "@/lib/editor/zoom-transform";
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
  useEffect(() => {
    projectRef.current = project;
  });
  // Guards the cut-skip below against re-firing every animation frame: once
  // `video.currentTime` is set to a cut's `endTime`, reading it back on the
  // very next tick can land a hair *before* `endTime` (seek imprecision, not
  // real playback progress) — still inside `[startTime, endTime)`, which
  // without this guard re-triggers the same seek forever and freezes the
  // player right at the boundary. Tracking the *id* of the cut already
  // skipped (rather than a plain boolean) means back-to-back cuts each still
  // get skipped once, and the guard clears itself the moment playback
  // genuinely advances past `endTime` for real.
  const skippedCutIdRef = useRef<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      const time = video.currentTime;
      const { cuts, zoomRegions } = projectRef.current;

      const activeCut = cuts.find((cut) => cut.type === "cut" && time >= cut.startTime && time < cut.endTime);
      if (activeCut && activeCut.id !== skippedCutIdRef.current) {
        skippedCutIdRef.current = activeCut.id;
        const duration = video.duration;
        // A cut reaching (or essentially reaching) the end of the clip has
        // nowhere valid to seek to — landing on/after `duration` can stall
        // rather than cleanly reach `ended`, so let it play out instead.
        video.currentTime =
          Number.isFinite(duration) && activeCut.endTime >= duration - 0.05 ? duration : activeCut.endTime;
      } else if (!activeCut) {
        skippedCutIdRef.current = null;
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

  const zoomTransform = computeZoomTransform(activeZoomRegion);

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
