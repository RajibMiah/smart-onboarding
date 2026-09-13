"use client";

import { useEditor } from "@/context/EditorContext";
import type { CanvasAspectRatio } from "@/lib/editor/types";
import { DEFAULT_FILTER_SETTINGS, type VideoFilterSettings } from "@/types/project";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  onNotify: (message: string) => void;
}

const ASPECT_RATIOS: { id: CanvasAspectRatio; label: string }[] = [
  { id: "16:9", label: "16:9 Desktop" },
  { id: "9:16", label: "9:16 Mobile" },
  { id: "1:1", label: "1:1 Square" },
];

const CANVAS_COLORS = ["#000000", "#FFFFFF", "#FACC15"];

const EXPORT_PRESETS = ["1080p · High quality", "720p · Balanced", "480p · Small file"];

const FILTER_SLIDERS: { key: "brightness" | "contrast" | "saturation"; label: string }[] = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
];

/** Aspect ratio genuinely reshapes the preview stage; background color and export are honest stubs. */
export const SettingsPanel = ({ onNotify }: SettingsPanelProps) => {
  const { state, setCanvasAspectRatio, setFilters } = useEditor();

  return (
    <div className="flex flex-col gap-5 p-3">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Filters</p>
          {JSON.stringify(state.filters) !== JSON.stringify(DEFAULT_FILTER_SETTINGS) && (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTER_SETTINGS)}
              className="text-[11px] font-semibold text-neutral-500 underline underline-offset-2 hover:text-black"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {FILTER_SLIDERS.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-xs font-medium text-neutral-600">
                {label}
                <span className="font-mono text-black">{state.filters[key]}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={200}
                value={state.filters[key]}
                onChange={(event) => setFilters({ [key]: Number(event.target.value) } as Partial<VideoFilterSettings>)}
                className="h-1.5 w-full cursor-pointer appearance-none border border-black bg-neutral-200 accent-black"
              />
            </label>
          ))}

          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-xs font-medium text-neutral-600">
              Volume gain
              <span className="font-mono text-black">{state.filters.volumeGain.toFixed(2)}x</span>
            </span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={state.filters.volumeGain}
              onChange={(event) => setFilters({ volumeGain: Number(event.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none border border-black bg-neutral-200 accent-black"
            />
          </label>

          <button
            type="button"
            onClick={() => setFilters({ noiseSuppression: !state.filters.noiseSuppression })}
            aria-pressed={state.filters.noiseSuppression}
            className={cn(
              "border-2 px-3 py-2 text-left text-sm font-medium transition",
              state.filters.noiseSuppression
                ? "border-black bg-brand-yellow text-black"
                : "border-black/20 text-neutral-600 hover:border-black",
            )}
          >
            Noise suppression {state.filters.noiseSuppression ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Aspect ratio</p>
        <div className="flex flex-col gap-2">
          {ASPECT_RATIOS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCanvasAspectRatio(id)}
              aria-pressed={state.canvasAspectRatio === id}
              className={cn(
                "border-2 px-3 py-2 text-left text-sm font-medium transition",
                state.canvasAspectRatio === id
                  ? "border-black bg-brand-yellow text-black"
                  : "border-black/20 text-neutral-600 hover:border-black",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Canvas background</p>
        <div className="flex gap-2">
          {CANVAS_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onNotify("Custom canvas backgrounds aren't available in this offline preview yet.")}
              style={{ backgroundColor: color }}
              aria-label={`Set canvas background to ${color}`}
              className="h-8 w-8 border-2 border-black"
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Export preset</p>
        <div className="flex flex-col gap-2">
          {EXPORT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onNotify("Exporting isn't available in this offline preview yet.")}
              className="border-2 border-black/20 px-3 py-2 text-left text-sm text-neutral-700 transition hover:border-black hover:bg-neutral-100"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
