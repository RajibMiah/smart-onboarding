"use client";

import { useCallback, useState } from "react";
import { Scissors, Sparkles, Trash2 } from "lucide-react";

import { useEditor } from "@/context/EditorContext";
import { useFFmpegWasm } from "@/hooks/useFFmpegWasm";
import { detectSilence } from "@/lib/editor/silence-detection";
import { inferExtension, formatTimecode } from "@/lib/editor/media-utils";
import type { CutType, TimelineCut } from "@/types/project";
import { cn } from "@/lib/utils";

interface CutsPanelProps {
  onNotify: (message: string) => void;
}

const DEFAULT_CUT_DURATION_SECONDS = 2;

const TYPE_LABEL: Record<CutType, string> = {
  keep: "Keep",
  cut: "Cut",
  silence_speedup: "Silence speedup",
};

/** Non-destructive cut-list editor: manual cuts plus ffmpeg.wasm-backed silence detection. */
export const CutsPanel = ({ onNotify }: CutsPanelProps) => {
  const { state, videoClips, addCut, updateCut, removeCut, setCuts, seek } = useEditor();
  const { extractAudio, isLoading: isFfmpegBusy, progress } = useFFmpegWasm();
  const [isDetecting, setIsDetecting] = useState(false);

  const primaryClip = videoClips[0] ?? null;
  const sortedCuts = [...state.cuts].sort((a, b) => a.startTime - b.startTime);

  const handleAddManualCut = useCallback(() => {
    addCut({
      startTime: state.currentTime,
      endTime: state.currentTime + DEFAULT_CUT_DURATION_SECONDS,
      type: "cut",
    });
  }, [addCut, state.currentTime]);

  const handleDetectSilence = useCallback(async () => {
    if (!primaryClip) {
      onNotify("Add a video to the timeline before detecting silence.");
      return;
    }
    setIsDetecting(true);
    try {
      const extension = inferExtension(primaryClip.name);
      const { blob } = await extractAudio(primaryClip.src, extension);
      const detected = await detectSilence(blob, { timelineOffset: primaryClip.startOffset });
      if (detected.length === 0) {
        onNotify("No stretches of silence long enough to flag were found.");
        return;
      }
      // Replace any previously auto-detected silence cuts rather than piling
      // up duplicates on repeated runs — manual cut/keep entries are untouched.
      const manualCuts = state.cuts.filter((cut) => cut.type !== "silence_speedup");
      setCuts([...manualCuts, ...detected]);
      onNotify(`Found ${detected.length} silent stretch${detected.length === 1 ? "" : "es"} to speed up.`);
    } catch {
      onNotify("Couldn't analyze this clip's audio for silence.");
    } finally {
      setIsDetecting(false);
    }
  }, [primaryClip, extractAudio, state.cuts, setCuts, onNotify]);

  return (
    <div className="flex flex-col gap-4 p-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Silence detection</p>
        <button
          type="button"
          onClick={handleDetectSilence}
          disabled={isDetecting || isFfmpegBusy}
          className="flex w-full items-center justify-center gap-2 border-2 border-black bg-brand-yellow px-3 py-2 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {isDetecting ? `Analyzing… ${Math.round(progress * 100)}%` : "Detect Silence"}
        </button>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Cuts ({sortedCuts.length})</p>
          <button
            type="button"
            onClick={handleAddManualCut}
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600 hover:text-black"
          >
            <Scissors className="h-3 w-3" /> Add at playhead
          </button>
        </div>

        {sortedCuts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 border-2 border-dashed border-black p-6 text-center">
            <p className="text-xs text-neutral-500">No cuts yet — mark a range manually or run silence detection.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedCuts.map((cut) => (
              <CutRow
                key={cut.id}
                cut={cut}
                onSeek={() => seek(cut.startTime)}
                onChangeType={(type) =>
                  updateCut(cut.id, type === "silence_speedup" ? { type, speedMultiplier: cut.speedMultiplier ?? 2 } : { type })
                }
                onRemove={() => removeCut(cut.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CutRow = ({
  cut,
  onSeek,
  onChangeType,
  onRemove,
}: {
  cut: TimelineCut;
  onSeek: () => void;
  onChangeType: (type: CutType) => void;
  onRemove: () => void;
}) => {
  return (
    <div className="border-2 border-black/20 p-2 transition hover:border-black">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onSeek} className="text-left text-xs font-semibold text-black hover:underline">
          {formatTimecode(cut.startTime)} – {formatTimecode(cut.endTime)}
        </button>
        <button type="button" onClick={onRemove} aria-label="Remove cut" className="p-0.5 text-neutral-400 hover:text-black">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {(Object.keys(TYPE_LABEL) as CutType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChangeType(type)}
            className={cn(
              "border px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase",
              cut.type === type ? "border-black bg-black text-white" : "border-black/20 text-neutral-500 hover:border-black",
            )}
          >
            {TYPE_LABEL[type]}
          </button>
        ))}
        {cut.type === "silence_speedup" && cut.speedMultiplier && (
          <span className="ml-auto font-mono text-[10px] font-semibold text-neutral-500">{cut.speedMultiplier}x</span>
        )}
      </div>
    </div>
  );
};
