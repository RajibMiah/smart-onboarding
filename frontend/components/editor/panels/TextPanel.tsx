"use client";

import { useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Trash2, Type } from "lucide-react";

import { useEditor } from "@/context/EditorContext";
import { formatTimecode } from "@/lib/editor/media-utils";
import { cn } from "@/lib/utils";
import type { BoundingBox, TextRegion } from "@/types/overlays";

interface TextPanelProps {
  onNotify: (message: string) => void;
}

type PresetId = "title" | "subtitle" | "step-callout" | "lower-third";

interface TextPreset {
  label: string;
  content: string;
  bounds: BoundingBox;
  style: TextRegion["style"];
}

const PRESETS: Record<PresetId, TextPreset> = {
  title: {
    label: "Title",
    content: "Your title",
    bounds: { x: 0.1, y: 0.08, width: 0.8, height: 0.16 },
    style: { fontSize: 40, fontWeight: "800", textColor: "#000000", backgroundColor: "transparent", textAlign: "center" },
  },
  subtitle: {
    label: "Subtitle",
    content: "Your subtitle",
    bounds: { x: 0.15, y: 0.28, width: 0.7, height: 0.1 },
    style: { fontSize: 22, fontWeight: "600", textColor: "#000000", backgroundColor: "transparent", textAlign: "center" },
  },
  "step-callout": {
    label: "Step Callout",
    content: "Step 1",
    bounds: { x: 0.05, y: 0.06, width: 0.16, height: 0.1 },
    style: { fontSize: 18, fontWeight: "700", textColor: "#FFFFFF", backgroundColor: "#000000", textAlign: "center" },
  },
  "lower-third": {
    label: "Lower Third",
    content: "Your name here",
    bounds: { x: 0.05, y: 0.78, width: 0.5, height: 0.14 },
    style: { fontSize: 22, fontWeight: "600", textColor: "#FFFFFF", backgroundColor: "#000000", textAlign: "left" },
  },
};

const BACKGROUND_SWATCHES = ["#000000", "#FFD200", "#FFFFFF", "transparent"];
const ALIGN_OPTIONS: { id: TextRegion["style"]["textAlign"]; icon: typeof AlignLeft }[] = [
  { id: "left", icon: AlignLeft },
  { id: "center", icon: AlignCenter },
  { id: "right", icon: AlignRight },
];

/**
 * "Add Text Box" places a new region immediately at a preset default
 * position (no marquee draw, unlike zoom/blur — matches how a lower-third
 * or title card is normally just dropped in and then repositioned).
 */
export const TextPanel = ({ onNotify }: TextPanelProps) => {
  const { videoClips, state, addTextRegion, updateTextRegion, removeTextRegion, selectTextRegion } = useEditor();
  const [selectedPreset, setSelectedPreset] = useState<PresetId>("lower-third");
  const hasMedia = videoClips.length > 0;

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-neutral-500">Pick a style, drop it on the canvas, then drag or resize it into place.</p>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSelectedPreset(id)}
            aria-pressed={selectedPreset === id}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 border-2 p-2 text-center transition",
              selectedPreset === id ? "border-black bg-brand-yellow" : "border-black/20 hover:border-black",
            )}
          >
            <span className="truncate text-xs font-bold text-black">{PRESETS[id].content}</span>
            <span className="text-[10px] font-medium text-neutral-500">{PRESETS[id].label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!hasMedia}
        onClick={() => {
          const preset = PRESETS[selectedPreset];
          addTextRegion({ content: preset.content, bounds: preset.bounds, style: preset.style });
        }}
        className={cn(
          "flex items-center justify-center gap-2 border-2 border-black py-2.5 text-sm font-semibold transition",
          hasMedia ? "bg-brand-yellow text-black hover:bg-yellow-500" : "cursor-not-allowed border-black/20 bg-neutral-100 text-neutral-400",
        )}
      >
        <Type className="h-4 w-4" />
        Add Text Box
      </button>

      {state.textRegions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Text layers ({state.textRegions.length})
          </p>
          <div className="flex flex-col gap-2">
            {state.textRegions.map((region) => (
              <div
                key={region.id}
                onPointerDown={() => selectTextRegion(region.id)}
                className={cn(
                  "flex flex-col gap-2.5 border-2 p-3 transition",
                  state.selectedTextId === region.id ? "border-black" : "border-black/20",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-black">
                    <Type className="h-3.5 w-3.5" /> Text
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTextRegion(region.id)}
                    aria-label="Delete text layer"
                    className="p-1 text-neutral-400 transition hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <textarea
                  value={region.content}
                  onChange={(event) => updateTextRegion(region.id, { content: event.target.value })}
                  rows={2}
                  className="w-full resize-none border border-black p-2 text-xs text-black focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Font size</span>
                    <span className="font-mono text-xs font-bold text-black">{region.style.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={64}
                    value={region.style.fontSize}
                    onChange={(event) =>
                      updateTextRegion(region.id, { style: { ...region.style, fontSize: Number(event.target.value) } })
                    }
                    className="w-full accent-black"
                    aria-label="Font size"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                    Text
                    <input
                      type="color"
                      value={region.style.textColor}
                      onChange={(event) => updateTextRegion(region.id, { style: { ...region.style, textColor: event.target.value } })}
                      className="h-6 w-8 cursor-pointer border border-black p-0"
                      aria-label="Text color"
                    />
                  </label>

                  <div className="flex items-center gap-1">
                    {BACKGROUND_SWATCHES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateTextRegion(region.id, { style: { ...region.style, backgroundColor: color } })}
                        aria-label={`Background ${color}`}
                        aria-pressed={region.style.backgroundColor === color}
                        style={{ backgroundColor: color === "transparent" ? "#fff" : color }}
                        className={cn(
                          "h-6 w-6 border-2",
                          region.style.backgroundColor === color ? "border-black" : "border-black/20",
                          color === "transparent" && "bg-[repeating-conic-gradient(#d4d4d4_0_25%,white_0_50%)] bg-[length:8px_8px]",
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-1">
                  {ALIGN_OPTIONS.map(({ id, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => updateTextRegion(region.id, { style: { ...region.style, textAlign: id } })}
                      aria-pressed={region.style.textAlign === id}
                      className={cn(
                        "flex flex-1 items-center justify-center border-2 py-1.5 transition",
                        region.style.textAlign === id ? "border-black bg-brand-yellow" : "border-black/20 hover:border-black",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 text-black" />
                    </button>
                  ))}
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
