"use client";

import { useState } from "react";
import { Mic, Music2, Volume2, VolumeX, Wand2 } from "lucide-react";

import { useEditor } from "@/context/EditorContext";

interface AudioPanelProps {
  onNotify: (message: string) => void;
}

/** Volume/mute genuinely control the selected clip; the rest are honest stubs (no AI backend yet). */
export const AudioPanel = ({ onNotify }: AudioPanelProps) => {
  const { selectedClip, updateClip } = useEditor();
  const [noiseSuppression, setNoiseSuppression] = useState(false);

  if (!selectedClip) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-neutral-500">
        Select a clip on the timeline to adjust its audio.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-3">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Volume</span>
          <button
            type="button"
            onClick={() => updateClip(selectedClip.id, { muted: !selectedClip.muted }, { commit: true })}
            aria-pressed={selectedClip.muted}
            className="flex items-center gap-1 border border-black px-2 py-0.5 text-xs font-semibold text-black transition hover:bg-neutral-100"
          >
            {selectedClip.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {selectedClip.muted ? "Muted" : "Mute"}
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={selectedClip.volume}
          disabled={selectedClip.muted}
          onChange={(event) => updateClip(selectedClip.id, { volume: Number(event.target.value) }, { commit: true })}
          className="w-full accent-black disabled:opacity-40"
          aria-label="Clip volume"
        />
      </div>

      <label className="flex items-center justify-between border-2 border-black p-3">
        <span className="flex items-center gap-2 text-sm font-medium text-black">
          <Mic className="h-4 w-4" /> Noise suppression
        </span>
        <input
          type="checkbox"
          checked={noiseSuppression}
          onChange={(event) => {
            setNoiseSuppression(event.target.checked);
            onNotify("Noise suppression isn't available in this offline preview yet.");
          }}
          className="h-4 w-4 accent-black"
        />
      </label>

      <button
        type="button"
        onClick={() => onNotify("Background music library isn't available in this offline preview yet.")}
        className="flex items-center gap-3 border-2 border-black p-3 text-left transition hover:bg-neutral-100"
      >
        <Music2 className="h-4 w-4 shrink-0 text-black" />
        <span>
          <span className="block text-sm font-semibold text-black">Background music</span>
          <span className="block text-xs text-neutral-500">Browse royalty-free tracks</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onNotify("AI voiceover generation isn't available in this offline preview yet.")}
        className="flex items-center gap-3 border-2 border-black p-3 text-left transition hover:bg-neutral-100"
      >
        <Wand2 className="h-4 w-4 shrink-0 text-black" />
        <span>
          <span className="block text-sm font-semibold text-black">AI voiceover</span>
          <span className="block text-xs text-neutral-500">Generate narration from a script</span>
        </span>
      </button>
    </div>
  );
};
