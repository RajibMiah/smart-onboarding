"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface ZoomPanelProps {
  onNotify: (message: string) => void;
}

const PRESETS = [1.25, 1.5, 2.0];

export function ZoomPanel({ onNotify }: ZoomPanelProps) {
  const [selected, setSelected] = useState(PRESETS[0]);

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-neutral-500">Zoom in on the mouse cursor at the current playhead position.</p>

      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setSelected(preset)}
            aria-pressed={selected === preset}
            className={cn(
              "border-2 py-3 text-sm font-bold transition",
              selected === preset ? "border-black bg-brand-yellow text-black" : "border-black/20 text-neutral-600 hover:border-black",
            )}
          >
            {preset.toFixed(2)}x
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onNotify(`Adding a ${selected.toFixed(2)}x zoom keyframe isn't available in this offline preview yet.`)}
        className="border-2 border-black bg-brand-yellow py-2 text-sm font-semibold text-black transition hover:bg-yellow-500"
      >
        + Add zoom keyframe
      </button>
    </div>
  );
}
