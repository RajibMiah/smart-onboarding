"use client";

import { useRef, useState, type RefObject } from "react";

import { useEditor } from "@/context/EditorContext";
import { useCanvasBoxDrag } from "@/hooks/useCanvasBoxDrag";
import { cn } from "@/lib/utils";
import type { BlurRegion, BoundingBox } from "@/types/overlays";

import { ResizeHandle } from "./ResizeHandle";

interface BlurOverlayProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

const MIN_DRAG_PX = 12;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Mirrors the zoom marquee: draw-to-create while `isDrawingBlur`, then
 * move/resize the just-created (auto-selected) region via corner handles.
 * Only regions covering the current playhead render at all — same
 * "active" convention as `activeZoomRegion`, so a region is only editable
 * on canvas while the playhead sits inside its own time range.
 */
export const BlurOverlay = ({ containerRef }: BlurOverlayProps) => {
  const { state, activeBlurRegions, addBlurRegion, updateBlurRegion, selectBlurRegion, cancelBlurDrawing } = useEditor();
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [dragBox, setDragBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = { x: clamp(event.clientX - rect.left, 0, rect.width), y: clamp(event.clientY - rect.top, 0, rect.height) };
    dragOriginRef.current = origin;
    setDragBox({ left: origin.x, top: origin.y, width: 0, height: 0 });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!origin || !rect) return;
    const currentX = clamp(event.clientX - rect.left, 0, rect.width);
    const currentY = clamp(event.clientY - rect.top, 0, rect.height);
    setDragBox({
      left: Math.min(origin.x, currentX),
      top: Math.min(origin.y, currentY),
      width: Math.abs(currentX - origin.x),
      height: Math.abs(currentY - origin.y),
    });
  };

  const handlePointerUp = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && dragBox && dragBox.width > MIN_DRAG_PX && dragBox.height > MIN_DRAG_PX) {
      addBlurRegion({
        x: dragBox.left / rect.width,
        y: dragBox.top / rect.height,
        width: dragBox.width / rect.width,
        height: dragBox.height / rect.height,
      });
    } else {
      cancelBlurDrawing();
    }
    dragOriginRef.current = null;
    setDragBox(null);
  };

  return (
    <>
      {state.isDrawingBlur && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 border-2 border-black bg-brand-yellow px-3 py-1.5 text-xs font-semibold text-black shadow-popover">
          Click and drag to redact an area
        </div>
      )}

      {state.isDrawingBlur ? (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute inset-0 z-20 cursor-crosshair"
        >
          {dragBox && (
            <div
              className="pointer-events-none absolute border-2 border-dashed border-brand-yellow bg-brand-yellow/20"
              style={{ left: dragBox.left, top: dragBox.top, width: dragBox.width, height: dragBox.height }}
            />
          )}
        </div>
      ) : (
        activeBlurRegions.length > 0 && (
          <div className="absolute inset-0 z-10" onPointerDown={() => selectBlurRegion(null)}>
            {activeBlurRegions.map((region) => (
              <BlurRegionBox
                key={region.id}
                region={region}
                containerRef={containerRef}
                selected={state.selectedBlurId === region.id}
                onSelect={() => selectBlurRegion(region.id)}
                onChangeBounds={(bounds) => updateBlurRegion(region.id, { bounds })}
              />
            ))}
          </div>
        )
      )}
    </>
  );
};

const BlurRegionBox = ({
  region,
  containerRef,
  selected,
  onSelect,
  onChangeBounds,
}: {
  region: BlurRegion;
  containerRef: RefObject<HTMLDivElement | null>;
  selected: boolean;
  onSelect: () => void;
  onChangeBounds: (bounds: BoundingBox) => void;
}) => {
  const { beginMove, beginResize } = useCanvasBoxDrag({ containerRef, bounds: region.bounds, onChange: onChangeBounds });

  return (
    <div
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        beginMove(event);
      }}
      className={cn("absolute cursor-move", selected && "outline outline-2 outline-brand-yellow")}
      style={{
        left: `${region.bounds.x * 100}%`,
        top: `${region.bounds.y * 100}%`,
        width: `${region.bounds.width * 100}%`,
        height: `${region.bounds.height * 100}%`,
        backdropFilter: `blur(${region.blurRadius}px)`,
        WebkitBackdropFilter: `blur(${region.blurRadius}px)`,
        clipPath: region.shape === "ellipse" ? "ellipse(50% 50% at 50% 50%)" : undefined,
        maskImage: region.feather ? "radial-gradient(ellipse at center, black 55%, transparent 100%)" : undefined,
        WebkitMaskImage: region.feather ? "radial-gradient(ellipse at center, black 55%, transparent 100%)" : undefined,
      }}
    >
      {selected && (
        <>
          <ResizeHandle corner="nw" onDragStart={(e) => beginResize(e, "nw")} />
          <ResizeHandle corner="ne" onDragStart={(e) => beginResize(e, "ne")} />
          <ResizeHandle corner="sw" onDragStart={(e) => beginResize(e, "sw")} />
          <ResizeHandle corner="se" onDragStart={(e) => beginResize(e, "se")} />
        </>
      )}
    </div>
  );
};
