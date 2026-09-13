export type TimeRangeDragMode = "move" | "trim-start" | "trim-end";

interface TimeRange {
  startTime: number;
  endTime: number;
}

/**
 * Shared pointer-drag math for any timeline block shaped as a
 * `{ startTime, endTime }` range — zoom, blur, and text overlay tracks all
 * move/trim the same way, unlike `TimelineClip` (which also has source
 * trim in/out points), so those keep their own `beginClipDrag`.
 */
export const beginTimeRangeDrag = <T extends TimeRange>(
  event: React.PointerEvent,
  original: T,
  mode: TimeRangeDragMode,
  zoomLevel: number,
  minDuration: number,
  onChange: (changes: Partial<TimeRange>) => void,
) => {
  event.stopPropagation();
  event.preventDefault();

  const startClientX = event.clientX;
  const duration = original.endTime - original.startTime;

  const onMove = (ev: PointerEvent) => {
    const deltaSeconds = (ev.clientX - startClientX) / zoomLevel;

    if (mode === "move") {
      const newStart = Math.max(0, original.startTime + deltaSeconds);
      onChange({ startTime: newStart, endTime: newStart + duration });
      return;
    }

    if (mode === "trim-start") {
      const newStart = Math.min(Math.max(0, original.startTime + deltaSeconds), original.endTime - minDuration);
      onChange({ startTime: newStart });
      return;
    }

    // trim-end
    const newEnd = Math.max(original.endTime + deltaSeconds, original.startTime + minDuration);
    onChange({ endTime: newEnd });
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
};
