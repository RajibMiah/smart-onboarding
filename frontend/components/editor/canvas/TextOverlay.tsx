"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { useEditor } from "@/context/EditorContext";
import { useCanvasBoxDrag } from "@/hooks/useCanvasBoxDrag";
import { cn } from "@/lib/utils";
import type { TextRegion } from "@/types/overlays";

import { ResizeHandle } from "./ResizeHandle";

interface TextOverlayProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Text regions are placed immediately (no marquee — see `TextPanel`'s
 * "Add Text Box"), then repositioned/resized here the same way blur
 * regions are. Double-click swaps the box into `contentEditable` for
 * inline editing; the panel's own textarea edits the same `content` field.
 */
export const TextOverlay = ({ containerRef }: TextOverlayProps) => {
  const { state, activeTextRegions, selectTextRegion, updateTextRegion } = useEditor();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (activeTextRegions.length === 0) return null;

  return (
    <div className="absolute inset-0 z-10" onPointerDown={() => selectTextRegion(null)}>
      {activeTextRegions.map((region) => (
        <TextRegionBox
          key={region.id}
          region={region}
          containerRef={containerRef}
          selected={state.selectedTextId === region.id}
          editing={editingId === region.id}
          onSelect={() => selectTextRegion(region.id)}
          onStartEditing={() => setEditingId(region.id)}
          onCommitContent={(content) => {
            updateTextRegion(region.id, { content });
            setEditingId(null);
          }}
          onChangeBounds={(bounds) => updateTextRegion(region.id, { bounds })}
        />
      ))}
    </div>
  );
};

const TextRegionBox = ({
  region,
  containerRef,
  selected,
  editing,
  onSelect,
  onStartEditing,
  onCommitContent,
  onChangeBounds,
}: {
  region: TextRegion;
  containerRef: RefObject<HTMLDivElement | null>;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onStartEditing: () => void;
  onCommitContent: (content: string) => void;
  onChangeBounds: (bounds: TextRegion["bounds"]) => void;
}) => {
  const { beginMove, beginResize } = useCanvasBoxDrag({ containerRef, bounds: region.bounds, onChange: onChangeBounds });
  const justify = region.style.textAlign === "center" ? "center" : region.style.textAlign === "right" ? "flex-end" : "flex-start";
  const editableRef = useRef<HTMLDivElement>(null);

  // contentEditable is DOM-managed, not React-managed — switching it on
  // doesn't move focus by itself, so without this a double-click "starts
  // editing" but the caret never actually lands and keystrokes fall through
  // to the page (and from there to the global timeline shortcuts).
  useEffect(() => {
    if (!editing) return;
    const el = editableRef.current;
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);

  return (
    <div
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        if (!editing) beginMove(event);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onSelect();
        onStartEditing();
      }}
      className={cn(
        "absolute flex overflow-hidden px-2 py-1",
        editing ? "cursor-text" : "cursor-move",
        selected && "outline outline-2 outline-brand-yellow",
      )}
      style={{
        left: `${region.bounds.x * 100}%`,
        top: `${region.bounds.y * 100}%`,
        width: `${region.bounds.width * 100}%`,
        height: `${region.bounds.height * 100}%`,
        fontSize: region.style.fontSize,
        fontWeight: region.style.fontWeight,
        color: region.style.textColor,
        backgroundColor: region.style.backgroundColor,
        justifyContent: justify,
        alignItems: "center",
      }}
    >
      {/* Keyed on content so an external edit (e.g. the panel's textarea)
          re-syncs this contentEditable's DOM text — otherwise React never
          touches it again after the first render. */}
      <div
        ref={editableRef}
        key={editing ? "editing" : region.content}
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={(event) => onCommitContent(event.currentTarget.textContent ?? "")}
        className="w-full min-w-0 outline-none"
        style={{ textAlign: region.style.textAlign }}
      >
        {region.content}
      </div>

      {selected && !editing && (
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
