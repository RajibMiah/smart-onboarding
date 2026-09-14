"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Pencil, Send } from "lucide-react";

import type { ApiStepGuide } from "@/lib/api-client";
import { formatTimecode } from "@/lib/editor/media-utils";
import { cn } from "@/lib/utils";

type DeckTab = "steps" | "transcript" | "activity";

const TABS: { id: DeckTab; label: string }[] = [
  { id: "steps", label: "Step-by-Step Guide" },
  { id: "transcript", label: "Interactive Transcript" },
  { id: "activity", label: "Activity / Feedback" },
];

interface ClipDocumentationDeckProps {
  clipId: string;
  stepGuides: ApiStepGuide[];
  onSeek: (seconds: number) => void;
  onOpenShare: () => void;
}

/** The SOP documentation deck under the player — step checklist, transcript,
 *  feedback, and the direct re-edit trigger into Studio. No studio-edit
 *  inspection here on purpose: that's a Studio/Review concern, not something
 *  a Theater viewer needs. */
export const ClipDocumentationDeck = ({ clipId, stepGuides, onSeek, onOpenShare }: ClipDocumentationDeckProps) => {
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
