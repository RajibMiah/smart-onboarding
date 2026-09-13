"use client";

import { useEditor } from "@/context/EditorContext";
import { formatTimecode } from "@/lib/editor/media-utils";
import { DEFAULT_FILTER_SETTINGS } from "@/types/project";

interface AppliedEditsSummaryProps {
  /** Seeks the Review page's own <video> preview element to a timestamp. */
  onSeek: (seconds: number) => void;
}

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Read-only inspection deck for everything the Studio session changed —
 * filters, cuts, and every overlay region — so a reviewer can verify each
 * edit without reopening the full editor. Clicking an overlay row seeks the
 * Review page's video straight to that region's start time.
 */
export const AppliedEditsSummary = ({ onSeek }: AppliedEditsSummaryProps) => {
  const { state, totalCutSeconds } = useEditor();
  const { zoomRegions, blurRegions, textRegions, cuts, filters } = state;

  const totalEdits = zoomRegions.length + blurRegions.length + textRegions.length + cuts.length;
  const appliedCuts = cuts.filter((cut) => cut.type !== "keep");

  const filterChips: string[] = [];
  if (filters.brightness !== DEFAULT_FILTER_SETTINGS.brightness) filterChips.push(`Brightness: ${filters.brightness}%`);
  if (filters.contrast !== DEFAULT_FILTER_SETTINGS.contrast) filterChips.push(`Contrast: ${filters.contrast}%`);
  if (filters.saturation !== DEFAULT_FILTER_SETTINGS.saturation) filterChips.push(`Saturation: ${filters.saturation}%`);
  if (filters.volumeGain !== DEFAULT_FILTER_SETTINGS.volumeGain) {
    filterChips.push(`Gain: ${filters.volumeGain >= 1 ? "+" : ""}${(filters.volumeGain - 1).toFixed(1)}x`);
  }
  if (filters.noiseSuppression) filterChips.push("Noise Suppression: ON");

  return (
    <div className="border border-black bg-white p-4">
      <div className="mb-3 flex items-center justify-between border-b border-black pb-2">
        <h2 className="text-sm font-bold text-black">Applied Studio Modifications</h2>
        <span className="border border-black bg-black px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
          Total Edits: {totalEdits}
        </span>
      </div>

      {filterChips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <span
              key={chip}
              className="border border-black bg-yellow-400 px-2 py-0.5 font-mono text-xs font-semibold text-black"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <p className="mb-3 text-xs font-medium text-neutral-600">
        {appliedCuts.length} Cut{appliedCuts.length === 1 ? "" : "s"} Applied
        {totalCutSeconds > 0 && ` • ${totalCutSeconds.toFixed(1)}s Trimmed`}
      </p>

      {totalEdits === 0 ? (
        <p className="text-xs text-neutral-400">No studio modifications were applied to this clip.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {zoomRegions.map((region) => (
            <OverlayRow key={region.id} onClick={() => onSeek(region.startTime)}>
              🔍 Zoom ({region.scale}x) — {formatTimecode(region.startTime)}
            </OverlayRow>
          ))}
          {blurRegions.map((region) => (
            <OverlayRow key={region.id} onClick={() => onSeek(region.startTime)}>
              🎭 Blur ({region.blurRadius}px) — {formatTimecode(region.startTime)}
            </OverlayRow>
          ))}
          {textRegions.map((region) => (
            <OverlayRow key={region.id} onClick={() => onSeek(region.startTime)}>
              🔤 Text (&quot;{truncate(region.content, 18)}&quot;) — {formatTimecode(region.startTime)}
            </OverlayRow>
          ))}
        </div>
      )}
    </div>
  );
};

const OverlayRow = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-black/20 px-2 py-1.5 text-left text-xs font-medium text-black transition hover:border-black hover:bg-yellow-400/20"
    >
      {children}
    </button>
  );
};
