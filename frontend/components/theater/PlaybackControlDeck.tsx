"use client";

import { VideoVolumeControl } from "@/components/theater/VideoVolumeControl";
import { cn } from "@/lib/utils";

export const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

interface PlaybackControlDeckProps {
  getElement: () => HTMLVideoElement | null;
  /** Re-applies the stored volume preference when the underlying <video>'s
   *  source changes — pass the active clip's id. */
  volumeApplyKey?: string;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onJump: (deltaSeconds: number) => void;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** ±5s / volume / speed / prev-next transport bar — shared by the Playlist
 *  Theater and the single-Clip Watch page so both stay visually and
 *  behaviorally identical. */
export const PlaybackControlDeck = ({
  getElement,
  volumeApplyKey,
  speed,
  onSpeedChange,
  onJump,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: PlaybackControlDeckProps) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-black bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onJump(-5)}
          className="border border-black px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-neutral-100"
        >
          ⟲ 5s
        </button>
        <button
          type="button"
          onClick={() => onJump(5)}
          className="border border-black px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-neutral-100"
        >
          5s ⟳
        </button>
        <VideoVolumeControl getElement={getElement} applyKey={volumeApplyKey} />
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Speed</span>
        {PLAYBACK_SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSpeedChange(option)}
            className={cn(
              "border border-black px-2 py-1 text-xs font-bold transition",
              speed === option ? "bg-brand-yellow text-black" : "text-black hover:bg-neutral-100",
            )}
          >
            {option}x
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!hasPrevious}
          onClick={onPrevious}
          className="border border-black px-3 py-1 text-xs font-semibold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
        </button>
        <button
          type="button"
          disabled={!hasNext}
          onClick={onNext}
          className="border border-black bg-black px-3 py-1 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next Clip ➔
        </button>
      </div>
    </div>
  );
};
