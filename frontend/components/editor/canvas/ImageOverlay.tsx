"use client";

import type { RefObject } from "react";

import { useEditor } from "@/context/EditorContext";
import { useCanvasBoxDrag } from "@/hooks/useCanvasBoxDrag";
import { cn } from "@/lib/utils";
import type { ImageOverlay as ImageOverlayRegion } from "@/types/overlays";

import { ResizeHandle } from "./ResizeHandle";

interface ImageOverlayProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Uploaded image overlays (logos, watermarks, picture-in-picture graphics) —
 * placed immediately at a default box on upload (see `useStudioUpload`), then
 * moved/resized here the same way blur and text regions are.
 */
export const ImageOverlay = ({ containerRef }: ImageOverlayProps) => {
  const { state, activeImageOverlays, selectImageOverlay, updateImageOverlay } = useEditor();

  if (activeImageOverlays.length === 0) return null;

  return (
    <div className="absolute inset-0 z-10" onPointerDown={() => selectImageOverlay(null)}>
      {activeImageOverlays.map((overlay) => (
        <ImageOverlayBox
          key={overlay.id}
          overlay={overlay}
          containerRef={containerRef}
          selected={state.selectedImageOverlayId === overlay.id}
          onSelect={() => selectImageOverlay(overlay.id)}
          onChangeBounds={(bounds) => updateImageOverlay(overlay.id, { bounds })}
        />
      ))}
    </div>
  );
};

const ImageOverlayBox = ({
  overlay,
  containerRef,
  selected,
  onSelect,
  onChangeBounds,
}: {
  overlay: ImageOverlayRegion;
  containerRef: RefObject<HTMLDivElement | null>;
  selected: boolean;
  onSelect: () => void;
  onChangeBounds: (bounds: ImageOverlayRegion["bounds"]) => void;
}) => {
  const { beginMove, beginResize } = useCanvasBoxDrag({ containerRef, bounds: overlay.bounds, onChange: onChangeBounds });

  return (
    <div
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        beginMove(event);
      }}
      className={cn("absolute cursor-move", selected && "outline outline-2 outline-brand-yellow")}
      style={{
        left: `${overlay.bounds.x * 100}%`,
        top: `${overlay.bounds.y * 100}%`,
        width: `${overlay.bounds.width * 100}%`,
        height: `${overlay.bounds.height * 100}%`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- object-URL/uploaded overlay image, not a static asset */}
      <img src={overlay.src} alt="" draggable={false} className="h-full w-full select-none object-contain" />

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
