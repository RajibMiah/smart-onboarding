"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { getStudioToolMeta } from "@/lib/editor/studio-tools";
import type { StudioTool } from "@/types/studio";

interface StudioDrawerProps {
  activeTool: StudioTool;
  isOpen: boolean;
  onCollapse: () => void;
  children: ReactNode;
}

const DRAWER_WIDTH_PX = 320; // w-80

/**
 * Always mounted — `isOpen` only toggles the outer wrapper's width between
 * 0 and 320px so the collapse/expand actually animates (a component that's
 * unmounted when "closed" can't play a closing transition).
 */
export const StudioDrawer = ({ activeTool, isOpen, onCollapse, children }: StudioDrawerProps) => {
  const meta = getStudioToolMeta(activeTool);
  const Icon = meta.icon;

  return (
    <div
      className="shrink-0 overflow-hidden border-r-2 border-black bg-white transition-[width] duration-200 ease-out"
      style={{ width: isOpen ? DRAWER_WIDTH_PX : 0 }}
    >
      <aside className="flex h-full w-80 flex-col">
        <div className="flex items-center justify-between border-b-2 border-black px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-black">
            <Icon className="h-4 w-4" /> {meta.label}
          </span>
          <button
            type="button"
            onClick={onCollapse}
            aria-label={`Collapse ${meta.label} panel`}
            className="p-1 text-black transition hover:bg-neutral-100"
          >
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </button>
        </div>

        <div
          id="studio-drawer-panel"
          role="tabpanel"
          aria-label={`${meta.label} panel`}
          className="flex-1 overflow-y-auto"
        >
          {children}
        </div>
      </aside>
    </div>
  );
};
