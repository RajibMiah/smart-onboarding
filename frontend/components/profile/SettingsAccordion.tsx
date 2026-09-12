"use client";

import { useId, useState, type ComponentType, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

interface SettingsAccordionProps {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Collapsible settings card. Animates height with the CSS grid-rows
 * `0fr -> 1fr` technique (no JS height measurement, so it works for content
 * of any/changing height) rather than a headless-UI library dependency.
 */
export function SettingsAccordion({ title, description, icon: Icon, defaultOpen = false, children }: SettingsAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2.5 font-semibold text-slate-900">
          <Icon className="h-[18px] w-[18px] text-slate-500" />
          {title}
        </span>
        <ChevronUp className={cn("h-4 w-4 text-slate-400 transition-transform", !open && "rotate-180")} />
      </button>

      <div
        id={contentId}
        role="region"
        aria-hidden={!open}
        // Prevents tabbing into hidden content while it's visually collapsed.
        inert={!open ? true : undefined}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-slate-100 px-5 py-4">
            {description && <p className="mb-4 text-sm text-slate-500">{description}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
