"use client";

import { Type } from "lucide-react";

import { useEditor } from "@/context/EditorContext";
import { beginTimeRangeDrag, type TimeRangeDragMode } from "@/lib/editor/timeline-drag";

const MIN_TEXT_SECONDS = 0.5;
const LABEL_MAX_CHARS = 14;

interface TextTimelineTrackProps {
  laneHeight: number;
  onLaneScrub: (event: React.PointerEvent) => void;
}

const truncate = (text: string): string => {
  const trimmed = text.trim() || "Text";
  return trimmed.length > LABEL_MAX_CHARS ? `${trimmed.slice(0, LABEL_MAX_CHARS)}…` : trimmed;
};

/** Timeline lane for text regions — same move/trim mechanics as the zoom lane. */
export const TextTimelineTrack = ({ laneHeight, onLaneScrub }: TextTimelineTrackProps) => {
  const { state, updateTextRegion, selectTextRegion } = useEditor();

  return (
    <div onPointerDown={onLaneScrub} className="relative border-b border-black/15 bg-white" style={{ height: laneHeight }}>
      {state.textRegions.map((region) => {
        const left = region.startTime * state.zoomLevel;
        const width = Math.max(4, (region.endTime - region.startTime) * state.zoomLevel);

        const onDragStart = (event: React.PointerEvent, mode: TimeRangeDragMode) => {
          selectTextRegion(region.id);
          beginTimeRangeDrag(event, region, mode, state.zoomLevel, MIN_TEXT_SECONDS, (changes) =>
            updateTextRegion(region.id, changes),
          );
        };

        return (
          <div
            key={region.id}
            onPointerDown={(event) => onDragStart(event, "move")}
            className="absolute top-1 flex cursor-grab items-center gap-1 overflow-hidden border-2 border-black bg-brand-yellow px-1.5 active:cursor-grabbing"
            style={{ left, width, height: laneHeight - 8 }}
          >
            <Type className="h-3 w-3 shrink-0 text-black" />
            <span className="truncate text-[10px] font-bold text-black">&quot;{truncate(region.content)}&quot;</span>

            <div
              onPointerDown={(event) => onDragStart(event, "trim-start")}
              className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20"
            />
            <div
              onPointerDown={(event) => onDragStart(event, "trim-end")}
              className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20"
            />
          </div>
        );
      })}
    </div>
  );
};
