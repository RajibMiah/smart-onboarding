"use client";

import { Search, Trash2, ZoomIn } from "lucide-react";

import { useEditor } from "@/context/EditorContext";
import { formatTimecode } from "@/lib/editor/media-utils";
import { cn } from "@/lib/utils";

interface ZoomPanelProps {
  onNotify: (message: string) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 3;

/**
 * "Create Zoom" hands off to `VideoCanvas`'s marquee-drawing mode (shared
 * `isDrawingZoom` state) — the region itself is only created there, once the
 * user actually drags a box, so this panel just lists what already exists.
 */
export const ZoomPanel = ({ onNotify }: ZoomPanelProps) => {
  const { videoClips, state, startZoomDrawing, cancelZoomDrawing, updateZoomRegion, removeZoomRegion } = useEditor();
  const hasMedia = videoClips.length > 0;

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-neutral-500">
        Draw a zoom region on the canvas — it animates in and back out as the playhead crosses it.
      </p>

      <button
        type="button"
        disabled={!hasMedia}
        onClick={() => (state.isDrawingZoom ? cancelZoomDrawing() : startZoomDrawing())}
        className={cn(
          "flex items-center justify-center gap-2 border-2 border-black py-2.5 text-sm font-semibold transition",
          !hasMedia
            ? "cursor-not-allowed border-black/20 bg-neutral-100 text-neutral-400"
            : state.isDrawingZoom
              ? "bg-black text-white"
              : "bg-brand-yellow text-black hover:bg-yellow-500",
        )}
      >
        <Search className="h-4 w-4" />
        {state.isDrawingZoom ? "Drawing… (drag on canvas)" : "Create Zoom"}
      </button>

      {state.zoomRegions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Active zoom effects ({state.zoomRegions.length})
          </p>
          <div className="flex flex-col gap-2">
            {state.zoomRegions.map((region) => (
              <div key={region.id} className="flex flex-col gap-2.5 border-2 border-black p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-black">
                    <ZoomIn className="h-3.5 w-3.5" /> {region.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeZoomRegion(region.id)}
                    aria-label={`Delete ${region.name}`}
                    className="p-1 text-neutral-400 transition hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Scale</span>
                    <span className="font-mono text-xs font-bold text-black">{region.scale.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={MIN_SCALE}
                    max={MAX_SCALE}
                    step={0.1}
                    value={region.scale}
                    onChange={(event) => updateZoomRegion(region.id, { scale: Number(event.target.value) })}
                    className="w-full accent-black"
                    aria-label={`${region.name} scale`}
                  />
                </div>

                <p className="font-mono text-[11px] text-neutral-500">
                  From {formatTimecode(region.startTime)} - {formatTimecode(region.endTime)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
