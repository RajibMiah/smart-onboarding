"use client";

import { useEffect, useState, type RefObject } from "react";
import { Maximize } from "lucide-react";

import { formatTimecode } from "@/lib/editor/media-utils";

interface VideoPlaybackControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  onToggleFullscreen: () => void;
}

/**
 * Play/pause, scrub, and fullscreen — deliberately NOT the video element's
 * own native `controls`. Native controls render as part of the `<video>`
 * element's own box, so they scale/distort right along with it whenever a
 * zoom region's `transform` is active; this bar is a sibling positioned
 * outside that transformed layer entirely, so it stays fixed regardless of
 * zoom. Volume/speed/±5s live in the separate `PlaybackControlDeck` row
 * below the player (Theater/Watch pages) — this only covers what native
 * `controls` used to provide that has nowhere else to live.
 */
export const VideoPlaybackControls = ({ videoRef, onToggleFullscreen }: VideoPlaybackControlsProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleDurationChange);
    video.addEventListener("durationchange", handleDurationChange);

    // Picks up a source that's already playing/loaded by the time this
    // effect attaches (e.g. autoPlayOnChange resuming before this mounts).
    setIsPlaying(!video.paused);
    handleDurationChange();

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleDurationChange);
      video.removeEventListener("durationchange", handleDurationChange);
    };
  }, [videoRef]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const next = Number(event.target.value);
    setCurrentTime(next);
    if (video) video.currentTime = next;
  };

  return (
    <div
      // Explicit `transform: none` (not just "never set one") — a stray
      // `transform` inherited or added here later would otherwise silently
      // start scaling this bar again, defeating the whole point of it
      // living outside the zoom-stage.
      style={{ transform: "none" }}
      className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-white/20 bg-black/80 px-3 py-1.5"
    >
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="shrink-0 border border-white/40 px-2 py-1 text-[11px] font-bold text-white transition hover:border-white hover:bg-white/10"
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
      <span className="shrink-0 font-mono text-[11px] text-white">{formatTimecode(currentTime)}</span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(currentTime, duration || 0)}
        onChange={handleSeek}
        aria-label="Seek"
        className="h-1 flex-1 cursor-pointer accent-brand-yellow"
      />
      <span className="shrink-0 font-mono text-[11px] text-white">{formatTimecode(duration)}</span>
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label="Toggle fullscreen"
        className="shrink-0 border border-white/40 p-1.5 text-white transition hover:border-white hover:bg-white/10"
      >
        <Maximize className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
