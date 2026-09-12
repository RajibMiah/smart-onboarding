"use client";

import { useRouter } from "next/navigation";
import { Ban, Copy, Eye, ListVideo, Pencil, Plus, Trash2 } from "lucide-react";

import { formatDuration, formatRelativeTime } from "@/lib/utils";
import type { Playlist } from "@/types/playlist";

import { ItemActionMenu } from "./ItemActionMenu";

interface PlaylistListItemProps {
  playlist: Playlist;
  firstThumbnailUrl?: string | null;
  totalDurationSeconds: number;
  onAddClips?: () => void;
  onRename?: () => void;
  onChangeVisibility?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

/** Clickable row -> `/library/playlists/[id]`; the action menu stops propagation so it doesn't also navigate. */
export function PlaylistListItem({
  playlist,
  firstThumbnailUrl,
  totalDurationSeconds,
  onAddClips,
  onRename,
  onChangeVisibility,
  onDuplicate,
  onDelete,
}: PlaylistListItemProps) {
  const router = useRouter();

  function navigate() {
    router.push(`/library/playlists/${playlist.id}`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={navigate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate();
        }
      }}
      className="group flex cursor-pointer items-stretch gap-4 border-2 border-black bg-white p-3 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
    >
      <div className="relative h-24 w-40 shrink-0">
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 border border-black bg-neutral-200" aria-hidden="true" />
        <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 border border-black bg-neutral-100" aria-hidden="true" />
        <div className="absolute inset-0 flex overflow-hidden border border-black bg-white">
          <div className="flex flex-1 items-center justify-center bg-neutral-50">
            {firstThumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- object-URL/arbitrary thumbnail
              <img src={firstThumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Ban className="h-6 w-6 text-neutral-300" aria-label="No videos" />
            )}
          </div>
          <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-1 border-l border-black bg-neutral-900 text-white">
            <span className="text-sm font-bold tabular-nums">{playlist.clipCount}</span>
            <ListVideo className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <h3 className="truncate text-base font-bold text-black transition group-hover:underline">{playlist.title}</h3>
        <p className="text-xs text-neutral-500" suppressHydrationWarning>
          Updated {formatRelativeTime(playlist.updatedAt)}
        </p>
        <p className="text-xs text-neutral-500">
          {playlist.clipCount} clip{playlist.clipCount === 1 ? "" : "s"} · {formatDuration(totalDurationSeconds)} total duration
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <span
          className={
            playlist.visibility === "private"
              ? "border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-xs text-red-600"
              : "border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs text-emerald-600"
          }
        >
          {playlist.visibility === "private" ? "Private" : "Public"}
        </span>

        <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <ItemActionMenu
            itemLabel={playlist.title}
            items={[
              { icon: Plus, label: "Add Clips", onClick: onAddClips },
              { icon: Pencil, label: "Rename", onClick: onRename },
              { icon: Eye, label: "Change Visibility", onClick: onChangeVisibility },
              { icon: Copy, label: "Duplicate", onClick: onDuplicate },
              { icon: Trash2, label: "Delete Playlist", tone: "danger", onClick: onDelete, dividerBefore: true },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
