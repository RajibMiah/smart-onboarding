"use client";

import { useCallback, type RefObject } from "react";

import type { BoundingBox } from "@/types/overlays";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

const MIN_BOX_SIZE = 0.04;

interface UseCanvasBoxDragOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  bounds: BoundingBox;
  onChange: (bounds: BoundingBox) => void;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Shared move/resize pointer math for a normalized `BoundingBox` overlaid on
 * a container element — used by both the blur and text canvas overlays.
 * Deltas are measured in the container's own pixels, then normalized, so it
 * doesn't matter that the two overlays sit at different points in the tree.
 */
export function useCanvasBoxDrag({ containerRef, bounds, onChange }: UseCanvasBoxDragOptions) {
  const beginMove = useCallback(
    (event: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const original = bounds;

      function onMove(ev: PointerEvent) {
        const dx = (ev.clientX - startClientX) / rect!.width;
        const dy = (ev.clientY - startClientY) / rect!.height;
        const x = clamp01(Math.min(Math.max(original.x + dx, 0), 1 - original.width));
        const y = clamp01(Math.min(Math.max(original.y + dy, 0), 1 - original.height));
        onChange({ ...original, x, y });
      }
      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [containerRef, bounds, onChange],
  );

  const beginResize = useCallback(
    (event: React.PointerEvent, corner: ResizeCorner) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const original = bounds;

      function onMove(ev: PointerEvent) {
        const dx = (ev.clientX - startClientX) / rect!.width;
        const dy = (ev.clientY - startClientY) / rect!.height;
        let { x, y, width, height } = original;

        if (corner === "se") {
          width = original.width + dx;
          height = original.height + dy;
        } else if (corner === "sw") {
          width = original.width - dx;
          height = original.height + dy;
          x = original.x + original.width - width;
        } else if (corner === "ne") {
          width = original.width + dx;
          height = original.height - dy;
          y = original.y + original.height - height;
        } else {
          width = original.width - dx;
          height = original.height - dy;
          x = original.x + original.width - width;
          y = original.y + original.height - height;
        }

        width = Math.max(width, MIN_BOX_SIZE);
        height = Math.max(height, MIN_BOX_SIZE);
        x = clamp01(Math.min(Math.max(x, 0), 1 - width));
        y = clamp01(Math.min(Math.max(y, 0), 1 - height));

        onChange({ x, y, width, height });
      }
      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [containerRef, bounds, onChange],
  );

  return { beginMove, beginResize };
}
