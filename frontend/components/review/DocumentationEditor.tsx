"use client";

import { useRef, type ChangeEvent } from "react";
import { Paperclip, Plus, Sparkles, Trash2 } from "lucide-react";

import { formatTimecode } from "@/lib/editor/media-utils";
import type { DocumentationStep } from "@/types/review";

interface DocumentationEditorProps {
  description: string;
  onDescriptionChange: (value: string) => void;
  onAutoCreateDescription: () => void;
  onAttachFile: () => void;
  steps: DocumentationStep[];
  onAddStep: () => void;
  onUpdateStep: (id: string, changes: Partial<Omit<DocumentationStep, "id">>) => void;
  onRemoveStep: (id: string) => void;
}

/** Description textarea + AI/attach triggers, and the step-by-step guide builder. */
export const DocumentationEditor = ({
  description,
  onDescriptionChange,
  onAutoCreateDescription,
  onAttachFile,
  steps,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
}: DocumentationEditorProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onAutoCreateDescription}
          className="flex items-center gap-1.5 border border-black px-3 py-1 text-xs font-semibold text-black transition hover:bg-yellow-400"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Auto-create description
        </button>
        <button
          type="button"
          onClick={onAttachFile}
          className="flex items-center gap-1.5 border border-black px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-neutral-100"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attach file
        </button>
      </div>

      <textarea
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="This description will be shown below your video"
        className="min-h-[140px] w-full border border-black p-4 text-sm placeholder:italic placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-black"
      />

      {steps.length > 0 && (
        <div className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <StepCard
              key={step.id}
              index={index}
              step={step}
              onUpdate={(changes) => onUpdateStep(step.id, changes)}
              onRemove={() => onRemoveStep(step.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAddStep}
        className="mx-auto flex items-center gap-2 border border-black px-6 py-2 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-neutral-100"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Step-by-Step Guide
      </button>
    </div>
  );
};

const StepCard = ({
  index,
  step,
  onUpdate,
  onRemove,
}: {
  index: number;
  step: DocumentationStep;
  onUpdate: (changes: Partial<Omit<DocumentationStep, "id">>) => void;
  onRemove: () => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onUpdate({ imageUrl: URL.createObjectURL(file) });
    event.target.value = "";
  };

  return (
    <div className="border border-black p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Step {index + 1}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-neutral-500">
            at
            <input
              type="number"
              min={0}
              value={step.timestamp}
              onChange={(event) => onUpdate({ timestamp: Math.max(0, Number(event.target.value)) })}
              aria-label={`Step ${index + 1} timestamp in seconds`}
              className="w-16 border border-black px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black"
            />
            s ({formatTimecode(step.timestamp)})
          </label>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove step ${index + 1}`}
            className="p-1 text-neutral-400 transition hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <input
        type="text"
        value={step.title}
        onChange={(event) => onUpdate({ title: event.target.value })}
        placeholder="Step title"
        aria-label={`Step ${index + 1} title`}
        className="mb-2 w-full border border-black px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-black"
      />

      <textarea
        value={step.content}
        onChange={(event) => onUpdate({ content: event.target.value })}
        placeholder="Instructions for this step"
        aria-label={`Step ${index + 1} instructions`}
        rows={2}
        className="mb-2 w-full resize-none border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
      />

      {step.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- object-URL preview, not a static asset
        <img src={step.imageUrl} alt="" className="h-24 w-full border border-black object-cover" />
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border border-dashed border-black/40 py-2 text-xs text-neutral-500 transition hover:border-black"
        >
          + Add image
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
    </div>
  );
};
