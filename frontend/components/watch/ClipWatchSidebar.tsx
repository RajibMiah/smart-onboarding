"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListVideo, Plus, User } from "lucide-react";

import type { ApiRelatedClip, ApiWatchPlaylistContext } from "@/lib/api-client";
import { usePlaylists } from "@/hooks/usePlaylists";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";

interface ClipWatchSidebarProps {
  clipId: string;
  playlistContext: ApiWatchPlaylistContext | null;
  relatedClips: ApiRelatedClip[];
  authorName: string;
  authorAvatarUrl: string;
  createdAt: string;
  durationSeconds: number;
  resolution: string;
  fileSizeBytes: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
};

export const ClipWatchSidebar = ({
  clipId,
  playlistContext,
  relatedClips,
  authorName,
  authorAvatarUrl,
  createdAt,
  durationSeconds,
  resolution,
  fileSizeBytes,
}: ClipWatchSidebarProps) => {
  const router = useRouter();

  if (playlistContext) {
    return (
      <aside className="flex h-full flex-col border border-black bg-white">
        <div className="border-b border-black bg-black px-4 py-3 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Part of</p>
          <h2 className="truncate text-sm font-bold">{playlistContext.title}</h2>
        </div>
        <div className="flex-1 divide-y divide-black overflow-y-auto">
          {playlistContext.items.map((item, index) => {
            const isActive = item.id === clipId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/library/clips/${item.id}/watch`)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                  isActive ? "border-l-4 border-brand-yellow bg-brand-yellow/10" : "border-l-4 border-transparent hover:bg-neutral-50",
                )}
              >
                <span className="w-6 shrink-0 font-mono text-xs font-bold text-neutral-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-xs text-black", isActive ? "font-bold" : "font-semibold")}>
                  {item.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-neutral-500">{formatDuration(Number(item.duration_seconds))}</span>
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full flex-col gap-4 border border-black bg-white p-4">
      <div>
        <h2 className="mb-3 border-b border-black pb-2 text-xs font-bold uppercase tracking-wide text-black">
          Clip Details &amp; Actions
        </h2>
        <div className="flex flex-col gap-2 text-xs text-neutral-600">
          <div className="flex items-center gap-2">
            {authorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary backend avatar URL
              <img src={authorAvatarUrl} alt="" crossOrigin="anonymous" className="h-6 w-6 rounded-full border border-black object-cover" />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center border border-black bg-neutral-100">
                <User className="h-3 w-3 text-neutral-400" />
              </span>
            )}
            <span className="font-semibold text-black">{authorName}</span>
          </div>
          <p suppressHydrationWarning>Created {formatRelativeTime(createdAt)}</p>
          <p>Duration: {formatDuration(durationSeconds)}</p>
          {resolution && <p>Resolution: {resolution}</p>}
          {fileSizeBytes > 0 && <p>File size: {formatFileSize(fileSizeBytes)}</p>}
        </div>
      </div>

      <AddToPlaylistAction clipId={clipId} />

      {relatedClips.length > 0 && (
        <div>
          <h3 className="mb-2 border-b border-black pb-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
            More from {authorName}
          </h3>
          <div className="flex flex-col gap-1">
            {relatedClips.map((clip) => (
              <button
                key={clip.id}
                type="button"
                onClick={() => router.push(`/library/clips/${clip.id}/watch`)}
                className="flex items-center gap-2 border border-black/20 px-2 py-1.5 text-left text-xs transition hover:border-black hover:bg-brand-yellow/10"
              >
                <ListVideo className="h-3 w-3 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate font-medium text-black">{clip.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-neutral-500">{formatDuration(Number(clip.duration_seconds))}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

const AddToPlaylistAction = ({ clipId }: { clipId: string }) => {
  const { playlists, addClipToPlaylist } = usePlaylists();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center gap-1.5 border border-black bg-white px-3 py-2 text-xs font-bold text-black transition hover:bg-neutral-100"
      >
        <Plus className="h-3.5 w-3.5" />
        Add to Playlist
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border border-black p-2">
      <select
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        className="border border-black bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
      >
        <option value="">Choose a playlist…</option>
        {playlists.map((playlist) => (
          <option key={playlist.id} value={playlist.id}>
            {playlist.title}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex-1 border border-black px-2 py-1.5 text-xs font-semibold text-black transition hover:bg-neutral-100"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!selectedId || isSaving}
          onClick={async () => {
            setIsSaving(true);
            try {
              await addClipToPlaylist(selectedId, clipId);
              setIsOpen(false);
            } finally {
              setIsSaving(false);
            }
          }}
          className="flex-1 border border-black bg-brand-yellow px-2 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
};
