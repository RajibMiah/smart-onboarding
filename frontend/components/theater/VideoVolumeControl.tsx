"use client";

import { useEffect, useRef, useState } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "apc_player_volume";

interface VolumePreference {
  volume: number;
  muted: boolean;
}

const readStoredPreference = (): VolumePreference => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: 1, muted: false };
    const parsed = JSON.parse(raw) as Partial<VolumePreference>;
    return {
      volume: typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1 ? parsed.volume : 1,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return { volume: 1, muted: false };
  }
};

interface VideoVolumeControlProps {
  /** Reads the currently active <video> element — a getter rather than the
   *  element itself, since the Theater swaps sources on the same long-lived
   *  element rather than remounting it per clip. */
  getElement: () => HTMLVideoElement | null;
  /** Re-applies the stored preference whenever this changes — pass the
   *  active clip's id so a freshly `.load()`ed element (which resets
   *  volume/muted to browser defaults) picks the preference back up. */
  applyKey?: string;
}

/** Editorial mute toggle + hover-expanding volume slider, persisted to
 *  localStorage so it carries across clips in a playlist and page reloads. */
export const VideoVolumeControl = ({ getElement, applyKey }: VideoVolumeControlProps) => {
  const [preference, setPreference] = useState<VolumePreference>(() => readStoredPreference());
  const [isExpanded, setIsExpanded] = useState(false);
  const lastNonZeroVolumeRef = useRef(preference.volume || 1);

  const applyToElement = (next: VolumePreference) => {
    const video = getElement();
    if (!video) return;
    video.volume = next.volume;
    video.muted = next.muted;
  };

  const updatePreference = (next: VolumePreference) => {
    setPreference(next);
    applyToElement(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort persistence — a private/blocked storage context just won't remember it.
    }
  };

  useEffect(() => {
    applyToElement(preference);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-apply only when the underlying element changes; `updatePreference` already applies on every deliberate volume/mute change
  }, [applyKey]);

  const isMuted = preference.muted || preference.volume === 0;

  const toggleMute = () => {
    if (isMuted) {
      updatePreference({ volume: lastNonZeroVolumeRef.current || 1, muted: false });
    } else {
      lastNonZeroVolumeRef.current = preference.volume || 1;
      updatePreference({ volume: preference.volume, muted: true });
    }
  };

  const handleSlide = (value: number) => {
    if (value > 0) lastNonZeroVolumeRef.current = value;
    updatePreference({ volume: value, muted: value === 0 });
  };

  const Icon = isMuted ? VolumeX : preference.volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-2" onMouseEnter={() => setIsExpanded(true)} onMouseLeave={() => setIsExpanded(false)}>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
        className="border border-black bg-white p-1.5 text-black transition hover:bg-neutral-100"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={isMuted ? 0 : preference.volume}
        onChange={(event) => handleSlide(Number(event.target.value))}
        aria-label="Volume"
        className={cn(
          "h-1.5 shrink-0 appearance-none border border-black bg-neutral-200 accent-black transition-all",
          isExpanded ? "w-20 opacity-100" : "w-0 border-0 opacity-0",
        )}
      />
    </div>
  );
};
