"use client";

import { Captions, MousePointerClick, Volume2 } from "lucide-react";

interface AutoEditPanelProps {
  onNotify: (message: string) => void;
}

const ACTIONS = [
  {
    icon: Volume2,
    title: "Remove silences",
    description: "Cuts out dead air between spoken sentences automatically.",
  },
  {
    icon: Captions,
    title: "Auto-generate subtitles",
    description: "Transcribes the clip and adds timed captions.",
  },
  {
    icon: MousePointerClick,
    title: "Auto-zoom on clicks",
    description: "Adds a zoom keyframe wherever a click is detected.",
  },
];

/** AI-assisted one-click actions — none run yet (no AI backend at this stage). */
export function AutoEditPanel({ onNotify }: AutoEditPanelProps) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-xs text-neutral-500">
        AI-assisted editing — runs once and previews the result on the timeline before you commit.
      </p>
      {ACTIONS.map(({ icon: Icon, title, description }) => (
        <button
          key={title}
          type="button"
          onClick={() => onNotify(`"${title}" isn't available in this offline preview yet.`)}
          className="flex items-start gap-3 border-2 border-black p-3 text-left transition hover:bg-neutral-100"
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-black" />
          <span>
            <span className="block text-sm font-semibold text-black">{title}</span>
            <span className="block text-xs text-neutral-500">{description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
