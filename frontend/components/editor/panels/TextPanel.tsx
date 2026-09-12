"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type TextPreset = "headline" | "subtitle" | "step-number" | "callout";

interface TextPanelProps {
  onNotify: (message: string) => void;
}

const PRESETS: { id: TextPreset; label: string; sample: string; className: string }[] = [
  { id: "headline", label: "Headline", sample: "Big Bold Title", className: "text-base font-black" },
  { id: "subtitle", label: "Subtitle", sample: "Supporting subtitle", className: "text-xs font-medium text-neutral-600" },
  { id: "step-number", label: "Step Number", sample: "01", className: "text-2xl font-black" },
  { id: "callout", label: "Callout Box", sample: "Pro tip", className: "text-[11px] font-bold uppercase tracking-wide" },
];

export function TextPanel({ onNotify }: TextPanelProps) {
  const [selected, setSelected] = useState<TextPreset>("headline");

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-xs text-neutral-500">Pick a style, then add it to the selected clip.</p>

      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map(({ id, label, sample, className }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSelected(id)}
            aria-pressed={selected === id}
            className={cn(
              "flex h-20 flex-col items-center justify-center gap-1 border-2 p-2 text-center transition",
              selected === id ? "border-black bg-brand-yellow" : "border-black/20 hover:border-black",
            )}
          >
            <span className={cn("truncate text-black", className)}>{sample}</span>
            <span className="text-[10px] font-medium text-neutral-500">{label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          const preset = PRESETS.find((item) => item.id === selected);
          onNotify(`Adding a "${preset?.label}" text layer isn't available in this offline preview yet.`);
        }}
        className="border-2 border-black bg-brand-yellow py-2 text-sm font-semibold text-black transition hover:bg-yellow-500"
      >
        + Add to canvas
      </button>
    </div>
  );
}
