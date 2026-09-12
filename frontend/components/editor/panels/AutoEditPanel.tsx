"use client";

import { useId, useState, type ComponentType, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Info, Mic, Play, Sparkles, Zap } from "lucide-react";

import { useEditor } from "@/context/EditorContext";
import {
  useAutoEditWorkflow,
  type SilenceStrategy,
  type VoiceoverMode,
} from "@/hooks/useAutoEditWorkflow";
import { cn } from "@/lib/utils";

interface AutoEditPanelProps {
  onNotify: (message: string) => void;
}

const VOICEOVER_OPTIONS: { id: VoiceoverMode; title: string; description: string }[] = [
  {
    id: "auto_generate",
    title: "Auto-Generate Explanation",
    description: "We will analyze your video and create automatic voiceovers",
  },
  {
    id: "ai_voice_clone",
    title: "Turn Original Audio into AI Voice",
    description: "Convert the original audio to a synthetic voice in the language of your choice.",
  },
  {
    id: "keep_original",
    title: "Keep Original Audio",
    description: "Keep your original audio and reduce background noise",
  },
];

const SILENCE_STRATEGIES: { id: SilenceStrategy; title: string; description: string }[] = [
  { id: "cut", title: "Cut sections without audio", description: "Removes all sections without audio" },
  { id: "speed_up", title: "Speed up sections without audio", description: "Keeps the section, just plays it back much faster" },
];

const SPEED_MULTIPLIERS = [2, 3, 4, 8];

/**
 * Auto-edit workflow form — fully interactive local config (voiceover mode,
 * silence handling, dictionary/publish toggles), wired through
 * `useAutoEditWorkflow`. "Apply Workflow" is a timed stub: there's no AI
 * backend yet, so it reports back via `onNotify` like the other panels.
 */
export function AutoEditPanel({ onNotify }: AutoEditPanelProps) {
  const { videoClips } = useEditor();
  const {
    config,
    isProcessing,
    setVoiceoverMode,
    setAdditionalContext,
    setUseDictionary,
    setShortenSilences,
    setSilenceStrategy,
    setSilenceSpeedMultiplier,
    setAutoPublish,
    applyWorkflow,
  } = useAutoEditWorkflow();
  const [customSpeedOpen, setCustomSpeedOpen] = useState(false);

  const hasMedia = videoClips.length > 0;
  const canApply = hasMedia && !isProcessing;
  const isCustomSpeed = !SPEED_MULTIPLIERS.includes(config.silenceSpeedMultiplier);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-1.5 border-b border-black/10 px-3 py-2">
          <p className="text-xs text-neutral-500">AI-assisted editing — previews on the timeline before you commit.</p>
          <button
            type="button"
            title="Runs once against the current timeline; you can re-run it any time before publishing."
            aria-label="About Auto-edit"
            className="shrink-0 text-neutral-400 transition hover:text-black"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-3">
          <EditorialAccordion icon={Zap} title="Video Enhancement" description="Clean up and polish your recording" defaultOpen>
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Voiceover</p>
                <div className="flex flex-col gap-2">
                  {VOICEOVER_OPTIONS.map(({ id, title, description }) => (
                    <RadioCard
                      key={id}
                      selected={config.voiceoverMode === id}
                      title={title}
                      description={description}
                      onSelect={() => setVoiceoverMode(id)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="auto-edit-context" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Additional Information
                </label>
                <textarea
                  id="auto-edit-context"
                  value={config.additionalContext}
                  onChange={(event) => setAdditionalContext(event.target.value)}
                  placeholder="Provide context for AI analysis..."
                  rows={3}
                  className="w-full resize-none border border-black p-2 text-xs text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <CheckboxCard
                checked={config.useDictionary}
                title="Use Dictionary"
                description="Use custom terminology for translations"
                onChange={setUseDictionary}
              />

              <div className="border-2 border-black p-3">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-semibold text-black">Shorten Silences</span>
                    <span className="block text-xs text-neutral-500">Automatically shorten parts of your video that have no audio</span>
                  </span>
                  <ToggleSwitch checked={config.shortenSilences} onChange={setShortenSilences} label="Shorten Silences" />
                </div>

                {config.shortenSilences && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-black/10 pt-3">
                    {SILENCE_STRATEGIES.map(({ id, title, description }) => (
                      <RadioCard
                        key={id}
                        compact
                        selected={config.silenceStrategy === id}
                        title={title}
                        description={description}
                        onSelect={() => setSilenceStrategy(id)}
                      />
                    ))}

                    {config.silenceStrategy === "speed_up" && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {SPEED_MULTIPLIERS.map((multiplier) => (
                          <button
                            key={multiplier}
                            type="button"
                            onClick={() => {
                              setSilenceSpeedMultiplier(multiplier);
                              setCustomSpeedOpen(false);
                            }}
                            aria-pressed={config.silenceSpeedMultiplier === multiplier}
                            className={cn(
                              "border px-3 py-1.5 text-xs font-bold transition",
                              config.silenceSpeedMultiplier === multiplier
                                ? "border-black bg-black text-white"
                                : "border-black/20 text-neutral-600 hover:border-black",
                            )}
                          >
                            {multiplier}x
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setCustomSpeedOpen((prev) => !prev)}
                          aria-pressed={isCustomSpeed}
                          aria-label="Custom speed multiplier"
                          className={cn(
                            "border px-3 py-1.5 text-xs font-bold transition",
                            isCustomSpeed ? "border-black bg-black text-white" : "border-black/20 text-neutral-600 hover:border-black",
                          )}
                        >
                          {isCustomSpeed ? `${config.silenceSpeedMultiplier}x` : "···"}
                        </button>
                        {customSpeedOpen && (
                          <input
                            type="number"
                            min={1}
                            max={20}
                            autoFocus
                            defaultValue={isCustomSpeed ? config.silenceSpeedMultiplier : ""}
                            onBlur={(event) => {
                              const value = Number(event.target.value);
                              if (value > 0) setSilenceSpeedMultiplier(value);
                              setCustomSpeedOpen(false);
                            }}
                            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                            className="w-16 border border-black p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </EditorialAccordion>

          <FlyoutCard
            icon={Mic}
            title="Voice & Language"
            description="Choose how your video sounds"
            onClick={() => onNotify("Voice & language picker isn't available in this offline preview yet.")}
          >
            <div className="flex flex-wrap gap-1.5">
              <Badge>{config.voiceSettings.language}</Badge>
              <Badge>{config.voiceSettings.voiceName}</Badge>
              <Badge>{config.voiceSettings.tone}</Badge>
              <Badge>{config.voiceSettings.speed.toFixed(1)}x Speed</Badge>
            </div>
          </FlyoutCard>

          <FlyoutCard
            icon={Sparkles}
            title="Sharing Options"
            description="Choose what gets generated from your video before sharing"
            onClick={() => onNotify("Sharing options aren't available in this offline preview yet.")}
          >
            <Badge>Not configured</Badge>
          </FlyoutCard>

          <CheckboxCard
            checked={config.autoPublish}
            title="Publish APC Project"
            description="Automatically make this project public upon workflow completion"
            onChange={setAutoPublish}
          />
        </div>
      </div>

      <div className="border-t-2 border-black p-3">
        <button
          type="button"
          disabled={!canApply}
          onClick={() => applyWorkflow(onNotify)}
          className={cn(
            "flex w-full items-center justify-center gap-2 border py-2.5 text-xs font-bold uppercase tracking-wider transition",
            canApply
              ? "border-black bg-brand-yellow text-black hover:bg-yellow-500"
              : "cursor-not-allowed border-black/20 bg-neutral-100 text-neutral-400",
          )}
        >
          <Play className="h-3.5 w-3.5" />
          {isProcessing ? "Applying…" : "Apply Workflow"}
        </button>
      </div>
    </div>
  );
}

function EditorialAccordion({
  icon: Icon,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="border-2 border-black">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/20 bg-neutral-100">
          <Icon className="h-4 w-4 text-black" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-black">{title}</span>
          <span className="block text-xs text-neutral-500">{description}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-black transition-transform", open && "rotate-180")} />
      </button>

      <div
        id={contentId}
        role="region"
        aria-hidden={!open}
        inert={!open ? true : undefined}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t-2 border-black p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function FlyoutCard({
  icon: Icon,
  title,
  description,
  onClick,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col gap-2.5 border-2 border-black p-3 text-left transition hover:bg-neutral-100">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/20 bg-neutral-100">
          <Icon className="h-4 w-4 text-black" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-black">{title}</span>
          <span className="block text-xs text-neutral-500">{description}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-black" />
      </div>
      {children}
    </button>
  );
}

function RadioCard({
  selected,
  title,
  description,
  onSelect,
  compact = false,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-2.5 border-2 p-2.5 text-left transition",
        selected ? "border-black bg-brand-yellow/10" : "border-black/20 hover:border-black",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-black" : "border-black/30",
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-black" />}
      </span>
      <span>
        <span className={cn("block font-medium text-black", compact ? "text-xs" : "text-sm")}>{title}</span>
        <span className="block text-xs text-neutral-500">{description}</span>
      </span>
    </button>
  );
}

function CheckboxCard({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 border-2 border-black p-3 text-left">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-black"
      />
      <span>
        <span className="block text-sm font-semibold text-black">{title}</span>
        <span className="block text-xs text-neutral-500">{description}</span>
      </span>
    </label>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full border border-black transition", checked ? "bg-black" : "bg-neutral-200")}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="border border-black bg-neutral-100 px-2 py-1 text-[11px] font-medium text-black">{children}</span>;
}
