"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { MoreHorizontal } from "lucide-react";

import { useClickOutside } from "@/hooks/useClickOutside";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  tone?: "default" | "danger";
  /** Renders a divider directly above this item — used to set off a destructive action. */
  dividerBefore?: boolean;
}

interface ItemActionMenuProps {
  itemLabel: string;
  items: ActionMenuItem[];
}

/** "···" row-actions dropdown — outside-click and Escape both close it. Item set is caller-defined (clips/pages/playlists each need a different list). */
export function ItemActionMenu({ itemLabel, items }: ItemActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function runAndClose(action?: () => void) {
    return () => {
      setOpen(false);
      action?.();
    };
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${itemLabel}`}
        className={cn(
          "border-2 border-black p-1 text-black transition hover:bg-neutral-100",
          open && "bg-neutral-100",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${itemLabel} actions`}
          className="absolute right-0 top-full z-20 mt-1 w-48 border-2 border-black bg-white py-1 shadow-popover animate-modal-in"
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.dividerBefore && <div className="my-1 h-px bg-black/15" />}
              <MenuItem icon={item.icon} label={item.label} tone={item.tone} onClick={runAndClose(item.onClick)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition",
        tone === "danger" ? "text-red-600 hover:bg-red-50" : "text-black hover:bg-neutral-100",
      )}
    >
      <Icon className={cn("h-4 w-4", tone === "danger" ? "text-red-500" : "text-neutral-500")} />
      {label}
    </button>
  );
}
