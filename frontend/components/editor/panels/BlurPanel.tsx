"use client";

import { Circle, Eye, EyeOff, Square, Trash2 } from "lucide-react";

import { useEditor } from "@/context/EditorContext";
import { formatTimecode } from "@/lib/editor/media-utils";
import { cn } from "@/lib/utils";
import type { BlurRegion } from "@/types/overlays";

interface BlurPanelProps {
  onNotify: (message: string) => void;
}

const MIN_RADIUS = 4;
const MAX_RADIUS = 40;

const SHAPES: { id: BlurRegion["shape"]; label: string; icon: typeof Square }[] = [
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
];

/**
 * "Add Blur Area" hands off to `BlurOverlay`'s marquee-drawing mode (shared
 * `isDrawingBlur` state) — the region itself is only created there, once the
 * user actually drags a box, so this panel just configures what exists.
 */
export function BlurPanel({ onNotify }: BlurPanelProps) {
  const { videoClips, state, startBlurDrawing, cancelBlurDrawing, updateBlurRegion, removeBlurRegion, selectBlurRegion } = useEditor();
  const hasMedia = videoClips.length > 0;

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-neutral-500">
        Draw a redaction box on the canvas — it blurs whatever is behind it as the playhead crosses its time range.
      </p>

      <button
        type="button"
        disabled={!hasMedia}
        onClick={() => (state.isDrawingBlur ? cancelBlurDrawing() : startBlurDrawing())}
        className={cn(
          "flex items-center justify-center gap-2 border-2 border-black py-2.5 text-sm font-semibold transition",
          !hasMedia
            ? "cursor-not-allowed border-black/20 bg-neutral-100 text-neutral-400"
            : state.isDrawingBlur
              ? "bg-black text-white"
              : "bg-brand-yellow text-black hover:bg-yellow-500",
        )}
      >
        <EyeOff className="h-4 w-4" />
        {state.isDrawingBlur ? "Drawing… (drag on canvas)" : "Add Blur Area"}
      </button>

      {state.blurRegions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Blur layers ({state.blurRegions.length})
          </p>
          <div className="flex flex-col gap-2">
            {state.blurRegions.map((region) => (
              <div
                key={region.id}
                onPointerDown={() => selectBlurRegion(region.id)}
                className={cn(
                  "flex flex-col gap-2.5 border-2 p-3 transition",
                  state.selectedBlurId === region.id ? "border-black" : "border-black/20",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-black">{region.name}</span>
                  <button
                    type="button"
                    onClick={() => removeBlurRegion(region.id)}
                    aria-label={`Delete ${region.name}`}
                    className="p-1 text-neutral-400 transition hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {SHAPES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => updateBlurRegion(region.id, { shape: id })}
                      aria-pressed={region.shape === id}
                      className={cn(
                        "flex flex-col items-center gap-1 border-2 py-2 text-[11px] font-medium transition",
                        region.shape === id ? "border-black bg-brand-yellow text-black" : "border-black/20 text-neutral-600 hover:border-black",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Blur radius</span>
                    <span className="font-mono text-xs font-bold text-black">{region.blurRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min={MIN_RADIUS}
                    max={MAX_RADIUS}
                    value={region.blurRadius}
                    onChange={(event) => updateBlurRegion(region.id, { blurRadius: Number(event.target.value) })}
                    className="w-full accent-black"
                    aria-label={`${region.name} blur radius`}
                  />
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-2 border border-black/20 px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-black">
                    {region.feather ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    Feather edge
                  </span>
                  <input
                    type="checkbox"
                    checked={region.feather}
                    onChange={(event) => updateBlurRegion(region.id, { feather: event.target.checked })}
                    className="h-4 w-4 accent-black"
                  />
                </label>

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
}
