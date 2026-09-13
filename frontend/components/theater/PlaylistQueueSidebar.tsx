"use client";

import { useState } from "react";
import { GripVertical, ListChecks } from "lucide-react";

import type { TheaterClipSummary } from "@/hooks/usePlaylistTheater";
import { cn, formatDuration } from "@/lib/utils";

interface PlaylistQueueSidebarProps {
  clips: TheaterClipSummary[];
  currentIndex: number;
  totalDurationSeconds: number;
  /** Drag-and-drop reordering is only offered to Creators, Leads, and Admins. */
  canReorder: boolean;
  isReordering: boolean;
  onSelect: (index: number) => void;
  onReorder: (orderedClipIds: string[]) => void;
}

/** Right-hand ordered clip queue — the Theater's "filmstrip". Reordering is a
 *  pure client-side drag preview until drop, when the new order is sent to
 *  the backend in one atomic call. */
export const PlaylistQueueSidebar = ({
  clips,
  currentIndex,
  totalDurationSeconds,
  canReorder,
  isReordering,
  onSelect,
  onReorder,
}: PlaylistQueueSidebarProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDrop = (dropIndex: number) => {
    const from = dragIndex;
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === dropIndex) return;

    const reordered = [...clips];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(dropIndex, 0, moved);
    onReorder(reordered.map((clip) => clip.id));
  };

  return (
    <aside className="flex h-full flex-col border border-black bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-black bg-black px-4 py-3 text-white">
        <h2 className="text-xs font-bold uppercase tracking-wider">
          Playlist Sequence ({clips.length} Clip{clips.length === 1 ? "" : "s"} • Total {formatDuration(totalDurationSeconds)})
        </h2>
        <ListChecks className="h-4 w-4 shrink-0" aria-hidden="true" />
      </div>

      <div className="flex-1 divide-y divide-black overflow-y-auto">
        {clips.map((clip, index) => {
          const isActive = index === currentIndex;
          const isVerified = clip.visibility === "published" && clip.status === "completed";

          return (
            <div
              key={clip.id}
              role="button"
              tabIndex={0}
              draggable={canReorder}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => {
                if (!canReorder || dragIndex === null) return;
                event.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(event) => {
                if (!canReorder) return;
                event.preventDefault();
                handleDrop(index);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(index);
                }
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition",
                isActive ? "border-l-4 border-brand-yellow bg-brand-yellow/10" : "border-l-4 border-transparent hover:bg-neutral-50",
                overIndex === index && dragIndex !== null && dragIndex !== index && "bg-neutral-100",
              )}
            >
              {canReorder && (
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-neutral-400" aria-label="Drag to reorder" />
              )}

              <span className="w-6 shrink-0 font-mono text-xs font-bold text-neutral-400">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="relative h-10 w-16 shrink-0 overflow-hidden border border-black bg-neutral-100">
                {clip.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary backend thumbnail URL
                  <img src={clip.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute bottom-0 right-0 bg-black px-1 font-mono text-[10px] text-white">
                  {formatDuration(clip.durationSeconds)}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-xs text-black", isActive ? "font-bold" : "font-semibold")}>{clip.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="truncate text-[11px] text-neutral-500">{clip.authorName}</span>
                  <span
                    className={cn(
                      "shrink-0 border px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      isVerified ? "border-emerald-600 text-emerald-700" : "border-neutral-300 text-neutral-500",
                    )}
                  >
                    {isVerified ? "Verified ✓" : "Draft"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isReordering && (
        <p className="border-t border-black bg-neutral-50 px-3 py-1.5 text-[11px] font-medium text-neutral-500">
          Saving new order…
        </p>
      )}
    </aside>
  );
};
