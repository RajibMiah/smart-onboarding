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

/** Collapsible settings card — sharp-bordered, matching the rest of the editorial UI. */
export const SettingsAccordion = ({ title, description, icon: Icon, defaultOpen = false, children }: SettingsAccordionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="border border-black bg-white">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2.5 text-sm font-bold text-black">
          <Icon className="h-[18px] w-[18px]" />
          {title}
        </span>
        <ChevronUp className={cn("h-4 w-4 text-black transition-transform", !open && "rotate-180")} />
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
          <div className="border-t border-black px-5 py-4">
            {description && <p className="mb-4 text-xs text-neutral-500">{description}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
