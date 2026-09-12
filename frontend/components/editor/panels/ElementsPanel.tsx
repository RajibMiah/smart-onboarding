"use client";

import { Award, MousePointerClick, Radar } from "lucide-react";

interface ElementsPanelProps {
  onNotify: (message: string) => void;
}

const ELEMENTS = [
  { id: "click-indicator", label: "Click Indicator", icon: MousePointerClick },
  { id: "badge", label: "Badge", icon: Award },
  { id: "cursor-highlight", label: "Cursor Highlight", icon: Radar },
];

export function ElementsPanel({ onNotify }: ElementsPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {ELEMENTS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onNotify(`Adding "${label}" isn't available in this offline preview yet.`)}
          className="flex h-20 flex-col items-center justify-center gap-1.5 border-2 border-black/20 p-2 text-center transition hover:border-black hover:bg-neutral-100"
        >
          <Icon className="h-5 w-5 text-black" />
          <span className="text-[11px] font-medium text-neutral-600">{label}</span>
        </button>
      ))}
    </div>
  );
}
