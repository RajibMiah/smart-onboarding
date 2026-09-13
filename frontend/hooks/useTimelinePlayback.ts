"use client";

import { useEffect, useMemo, useRef } from "react";

import { useEditor } from "@/context/EditorContext";
import { clipTimelineEnd, type TimelineClip } from "@/lib/editor/types";

interface UseTimelinePlaybackResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  activeClip: TimelineClip | null;
}

/**
 * Bridges the shared `EditorContext` timeline with a single `<video>`
 * element: picks whichever video clip covers the current playhead, keeps the
 * element's `src`/`currentTime` in sync with it, and — the reverse direction
 * — advances the shared playhead from the video's own `timeupdate` while
 * it's playing. When the playhead is in a gap (no clip covers it, e.g. after
 * deleting a middle clip), a `requestAnimationFrame` loop advances the
 * playhead instead, since there's no `<video>` to drive it.
 */
export const useTimelinePlayback = (): UseTimelinePlaybackResult => {
  const { videoClips, state, totalDuration, seek, pause } = useEditor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSrcRef = useRef<string | null>(null);
  const currentTimeRef = useRef(state.currentTime);

  useEffect(() => {
    currentTimeRef.current = state.currentTime;
  }, [state.currentTime]);

  const activeClip = useMemo(
    () =>
      videoClips.find(
        (clip) => state.currentTime >= clip.startOffset && state.currentTime < clipTimelineEnd(clip),
      ) ?? null,
    [videoClips, state.currentTime],
  );

  // Swap the <video> element's source when the covering clip changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    if (lastSrcRef.current !== activeClip.src) {
      video.src = activeClip.src;
      lastSrcRef.current = activeClip.src;
    }
  }, [activeClip]);

  // Keep the element's playback position aligned with the shared playhead
  // (large gaps only — small diffs are the element's own timeupdate feeding
  // back into `currentTime`, which must not re-trigger a seek).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    const targetSourceTime = activeClip.trimStart + (state.currentTime - activeClip.startOffset);
    if (Math.abs(video.currentTime - targetSourceTime) > 0.2) {
      video.currentTime = targetSourceTime;
    }
  }, [state.currentTime, activeClip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (state.isPlaying && activeClip) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [state.isPlaying, activeClip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    video.muted = activeClip.muted;
    video.volume = activeClip.volume;
  }, [activeClip]);

  // Drive the shared playhead from the element while it plays this clip.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;

    const onTimeUpdate = () => {
      if (!video || !activeClip) return;
      seek(activeClip.startOffset + (video.currentTime - activeClip.trimStart));
    };
    const onEnded = () => {
      pause();
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
    };
  }, [activeClip, seek, pause]);

  // Gap-filling clock: nothing covers the playhead, but playback is running.
  useEffect(() => {
    if (!state.isPlaying || activeClip) return;

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = (now - last) / 1000;
      last = now;
      const next = currentTimeRef.current + deltaSeconds;
      if (next >= totalDuration) {
        seek(totalDuration);
        pause();
        return;
      }
      seek(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.isPlaying, activeClip, totalDuration, seek, pause]);

  return { videoRef, activeClip };
};
