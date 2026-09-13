"use client";

import type { KeyboardEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { STUDIO_TOOLS } from "@/lib/editor/studio-tools";
import type { StudioTool, StudioToolMeta } from "@/types/studio";
import { cn } from "@/lib/utils";

interface StudioToolRailProps {
  activeTool: StudioTool;
  isDrawerOpen: boolean;
  isRailExpanded: boolean;
  onSelectTool: (tool: StudioTool) => void;
  onToggleExpanded: () => void;
}

const ARROW_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

/**
 * Vertical tool rail — a real `role="tablist"` with roving tabindex: only the
 * active tool is a tab stop, Arrow Up/Down (and Home/End) move focus between
 * the currently visible buttons, matching the ARIA APG tabs pattern.
 */
export const StudioToolRail = ({
  activeTool,
  isDrawerOpen,
  isRailExpanded,
  onSelectTool,
  onToggleExpanded,
}: StudioToolRailProps) => {
  const mediaTools = STUDIO_TOOLS.filter((tool) => tool.group === "media");
  const overlayTools = STUDIO_TOOLS.filter((tool) => tool.group === "overlay");

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!ARROW_KEYS.has(event.key)) return;
    event.preventDefault();

    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-tool-id]"));
    if (buttons.length === 0) return;
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);

    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
    else if (event.key === "ArrowUp") nextIndex = currentIndex < 0 ? buttons.length - 1 : (currentIndex - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = buttons.length - 1;

    buttons[nextIndex]?.focus();
  };

  return (
    <nav
      role="tablist"
      aria-label="Studio tools"
      aria-orientation="vertical"
      onKeyDown={handleKeyDown}
      className="flex w-20 shrink-0 flex-col border-r-2 border-black bg-white py-3"
    >
      <div className="flex flex-col items-center gap-1">
        {mediaTools.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            isCurrent={activeTool === tool.id}
            isSelected={activeTool === tool.id && isDrawerOpen}
            onSelect={() => onSelectTool(tool.id)}
          />
        ))}
      </div>

      <div className="my-2 h-px shrink-0 bg-black/15" aria-hidden="true" />

      {isRailExpanded && (
        <div className="flex flex-col items-center gap-1">
          {overlayTools.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isCurrent={activeTool === tool.id}
              isSelected={activeTool === tool.id && isDrawerOpen}
              onSelect={() => onSelectTool(tool.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={isRailExpanded}
        className="mt-auto flex w-full flex-col items-center gap-1 py-2 text-[10px] font-medium text-neutral-500 transition hover:bg-neutral-100"
      >
        {isRailExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {isRailExpanded ? "Less" : "More"}
      </button>
    </nav>
  );
};

const ToolButton = ({
  tool,
  isSelected,
  isCurrent,
  onSelect,
}: {
  tool: StudioToolMeta;
  /** Visually highlighted — the active tool AND its drawer is open. */
  isSelected: boolean;
  /** The rail's roving-tabindex stop, independent of drawer open/closed. */
  isCurrent: boolean;
  onSelect: () => void;
}) => {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      data-tool-id={tool.id}
      role="tab"
      aria-selected={isSelected}
      aria-controls="studio-drawer-panel"
      tabIndex={isCurrent ? 0 : -1}
      title={tool.label}
      onClick={onSelect}
      className={cn(
        "flex w-16 flex-col items-center gap-1 border py-2 text-[11px] font-medium transition",
        isSelected
          ? "border-black bg-brand-yellow font-bold text-black"
          : "border-transparent text-neutral-600 hover:bg-neutral-100",
      )}
    >
      <Icon className="h-5 w-5" />
      {tool.label}
    </button>
  );
};
