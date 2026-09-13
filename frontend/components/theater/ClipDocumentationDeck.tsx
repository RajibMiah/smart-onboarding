"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Pencil, Send } from "lucide-react";

import type { ApiStepGuide } from "@/lib/api-client";
import { formatTimecode } from "@/lib/editor/media-utils";
import { cn } from "@/lib/utils";
import { DEFAULT_FILTER_SETTINGS, type ProjectMetadataPayload } from "@/types/project";

type DeckTab = "steps" | "transcript" | "applied_edits" | "activity";

const TABS: { id: DeckTab; label: string }[] = [
  { id: "steps", label: "Step-by-Step Guide" },
  { id: "transcript", label: "Interactive Transcript" },
  { id: "applied_edits", label: "Applied Edits" },
  { id: "activity", label: "Activity / Feedback" },
];

interface ClipDocumentationDeckProps {
  clipId: string;
  stepGuides: ApiStepGuide[];
  project: ProjectMetadataPayload;
  onSeek: (seconds: number) => void;
  onOpenShare: () => void;
}

/** The SOP documentation deck under the player — step checklist, applied
 *  edits, and the direct re-edit trigger into Studio. */
export const ClipDocumentationDeck = ({ clipId, stepGuides, project, onSeek, onOpenShare }: ClipDocumentationDeckProps) => {
  const router = useRouter();
  const [tab, setTab] = useState<DeckTab>("steps");

  return (
    <div className="border border-black bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black">
        <div className="flex flex-wrap">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "border-r border-black px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition",
                tab === item.id ? "bg-brand-yellow text-black" : "text-neutral-500 hover:bg-neutral-50 hover:text-black",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => router.push(`/studio?clip=${clipId}`)}
          className="mr-3 flex shrink-0 items-center gap-1.5 border border-black bg-black px-3 py-1.5 text-xs font-bold text-white transition hover:bg-neutral-800"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit Clip in Studio
        </button>
      </div>

      <div className="p-4">
        {tab === "steps" && <StepByStepTab stepGuides={stepGuides} onSeek={onSeek} />}
        {tab === "transcript" && <EmptyDeckState text="An interactive transcript hasn't been generated for this clip yet." />}
        {tab === "applied_edits" && <AppliedEditsTab project={project} onSeek={onSeek} />}
        {tab === "activity" && <ActivityTab onOpenShare={onOpenShare} />}
      </div>
    </div>
  );
};

const EmptyDeckState = ({ text }: { text: string }) => <p className="py-6 text-center text-xs text-neutral-400">{text}</p>;

const StepByStepTab = ({ stepGuides, onSeek }: { stepGuides: ApiStepGuide[]; onSeek: (seconds: number) => void }) => {
  if (stepGuides.length === 0) {
    return <EmptyDeckState text="No step-by-step guide has been added for this clip yet." />;
  }

  return (
    <ol className="flex flex-col gap-2">
      {stepGuides.map((step) => (
        <li key={step.id}>
          <button
            type="button"
            onClick={() => onSeek(Number(step.timestamp_seconds))}
            className="flex w-full items-start gap-3 border border-black/20 px-3 py-2 text-left transition hover:border-black hover:bg-brand-yellow/10"
          >
            <span className="mt-0.5 shrink-0 border border-black bg-black px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
              {formatTimecode(Number(step.timestamp_seconds))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-black">
                Step {step.step_number}: {step.title}
              </span>
              {step.description_markdown && (
                <span className="mt-0.5 block whitespace-pre-wrap text-xs text-neutral-600">{step.description_markdown}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
};

const AppliedEditsTab = ({ project, onSeek }: { project: ProjectMetadataPayload; onSeek: (seconds: number) => void }) => {
  const { filters, cuts, zoomRegions, blurRegions, textOverlays } = project;
  const appliedCuts = cuts.filter((cut) => cut.type !== "keep");
  const totalEdits = zoomRegions.length + blurRegions.length + textOverlays.length + appliedCuts.length;

  const filterChips: string[] = [];
  if (filters.brightness !== DEFAULT_FILTER_SETTINGS.brightness) filterChips.push(`Brightness: ${filters.brightness}%`);
  if (filters.contrast !== DEFAULT_FILTER_SETTINGS.contrast) filterChips.push(`Contrast: ${filters.contrast}%`);
  if (filters.saturation !== DEFAULT_FILTER_SETTINGS.saturation) filterChips.push(`Saturation: ${filters.saturation}%`);
  if (filters.noiseSuppression) filterChips.push("Noise Suppression: ON");

  if (totalEdits === 0 && filterChips.length === 0) {
    return <EmptyDeckState text="No studio edits were applied to this clip." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <span key={chip} className="border border-black bg-brand-yellow px-2 py-0.5 font-mono text-xs font-semibold text-black">
              {chip}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {zoomRegions.map((region) => (
          <EditRow key={region.id} onClick={() => onSeek(region.startTime)}>
            🔍 Zoom ({region.scale}x) — {formatTimecode(region.startTime)}
          </EditRow>
        ))}
        {blurRegions.map((region) => (
          <EditRow key={region.id} onClick={() => onSeek(region.startTime)}>
            🎭 Blur ({region.blurRadius}px) — {formatTimecode(region.startTime)}
          </EditRow>
        ))}
        {textOverlays.map((region) => (
          <EditRow key={region.id} onClick={() => onSeek(region.startTime)}>
            🔤 Text overlay — {formatTimecode(region.startTime)}
          </EditRow>
        ))}
        {appliedCuts.map((cut) => (
          <EditRow key={cut.id} onClick={() => onSeek(cut.startTime)}>
            {cut.type === "cut" ? "✂️ Cut" : "⏩ Silence speedup"} — {formatTimecode(cut.startTime)}
          </EditRow>
        ))}
      </div>
    </div>
  );
};

const EditRow = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="border border-black/20 px-2 py-1.5 text-left text-xs font-medium text-black transition hover:border-black hover:bg-brand-yellow/10"
  >
    {children}
  </button>
);

const ActivityTab = ({ onOpenShare }: { onOpenShare: () => void }) => (
  <div className="flex flex-col items-center gap-3 py-6 text-center">
    <MessageSquare className="h-6 w-6 text-neutral-300" aria-hidden="true" />
    <p className="max-w-sm text-xs text-neutral-500">
      APC doesn&apos;t have open commenting on clips — feedback and sign-off happen through a Share Request instead.
    </p>
    <button
      type="button"
      onClick={onOpenShare}
      className="flex items-center gap-1.5 border border-black bg-brand-yellow px-3 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-500"
    >
      <Send className="h-3.5 w-3.5" />
      Share with Request
    </button>
  </div>
);
