"use client";

import type { ResizeCorner } from "@/hooks/useCanvasBoxDrag";
import { cn } from "@/lib/utils";

const CORNER_CLASS: Record<ResizeCorner, string> = {
  nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
  ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
  sw: "-left-1.5 -bottom-1.5 cursor-nesw-resize",
  se: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
};

export function ResizeHandle({ corner, onDragStart }: { corner: ResizeCorner; onDragStart: (event: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={(event) => {
        event.stopPropagation();
        onDragStart(event);
      }}
      className={cn("absolute h-3 w-3 border-2 border-black bg-brand-yellow", CORNER_CLASS[corner])}
    />
  );
}
