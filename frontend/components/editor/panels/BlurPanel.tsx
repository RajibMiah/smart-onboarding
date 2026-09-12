"use client";

import { useState } from "react";
import { Circle, Square, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

type BlurShape = "rectangle" | "ellipse";

interface BlurRegion {
  id: string;
  shape: BlurShape;
  intensity: number;
}

interface BlurPanelProps {
  onNotify: (message: string) => void;
}

const SHAPES: { id: BlurShape; label: string; icon: typeof Square }[] = [
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
];

/**
 * Privacy blur / redaction. The shape picker, intensity slider, and applied-
 * regions list are all genuinely interactive (local state); "Add to canvas"
 * appends to that list rather than actually compositing onto the video —
 * there's no canvas-overlay renderer yet, so this is scaffolding for one.
 */
export function BlurPanel({ onNotify }: BlurPanelProps) {
  const [shape, setShape] = useState<BlurShape>("rectangle");
  const [intensity, setIntensity] = useState(60);
  const [regions, setRegions] = useState<BlurRegion[]>([]);

  function handleAddToCanvas() {
    setRegions((prev) => [...prev, { id: crypto.randomUUID(), shape, intensity }]);
    onNotify("Blur region added to this clip's list — canvas compositing lands in a later phase.");
  }

  function removeRegion(id: string) {
    setRegions((prev) => prev.filter((region) => region.id !== id));
  }

  return (
    <div className="flex flex-col gap-5 p-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Shape</p>
        <div className="grid grid-cols-2 gap-2">
          {SHAPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setShape(id)}
              aria-pressed={shape === id}
              className={cn(
                "flex flex-col items-center gap-1.5 border-2 py-3 text-xs font-medium transition",
                shape === id ? "border-black bg-brand-yellow text-black" : "border-black/20 text-neutral-600 hover:border-black",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Intensity</span>
          <span className="font-mono text-xs font-bold text-black">{intensity}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={intensity}
          onChange={(event) => setIntensity(Number(event.target.value))}
          className="w-full accent-black"
          aria-label="Blur intensity"
        />
      </div>

      <button
        type="button"
        onClick={handleAddToCanvas}
        className="border-2 border-black bg-brand-yellow py-2 text-sm font-semibold text-black transition hover:bg-yellow-500"
      >
        + Add to canvas
      </button>

      {regions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Applied regions ({regions.length})
          </p>
          <ul className="flex flex-col gap-1.5">
            {regions.map((region) => {
              const Icon = region.shape === "rectangle" ? Square : Circle;
              return (
                <li key={region.id} className="flex items-center justify-between border border-black/30 px-2.5 py-1.5 text-xs">
                  <span className="flex items-center gap-2 font-medium text-black">
                    <Icon className="h-3.5 w-3.5" />
                    {region.shape === "rectangle" ? "Rectangle" : "Ellipse"} · {region.intensity}%
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRegion(region.id)}
                    aria-label="Remove blur region"
                    className="p-0.5 text-neutral-400 transition hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
