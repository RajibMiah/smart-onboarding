"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ListVideo } from "lucide-react";

import { ClipListItem } from "@/components/library/ClipListItem";
import { LibraryEmptyState } from "@/components/library/LibraryEmptyState";
import { useClips } from "@/hooks/useClips";
import { usePlaylists } from "@/hooks/usePlaylists";
import { formatRelativeTime } from "@/lib/utils";

interface PlaylistDetailPageProps {
  params: Promise<{ id: string }>;
}

const PlaylistDetailPage = ({ params }: PlaylistDetailPageProps) => {
  const { id } = use(params);
  const { playlists, isLoading } = usePlaylists();
  const { clips } = useClips();

  const playlist = playlists.find((item) => item.id === id);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <BackLink />
        <p className="text-xs text-neutral-500">Loading playlist…</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <BackLink />
        <LibraryEmptyState
          icon={ListVideo}
          title="Playlist not found"
          description="It may have been deleted, or the link is out of date."
        />
      </div>
    );
  }

  const playlistClips = playlist.clipIds
    .map((clipId) => clips.find((clip) => clip.id === clipId))
    .filter((clip) => clip !== undefined);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-black">{playlist.title}</h1>
            <span
              className={
                playlist.visibility === "private"
                  ? "border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-xs text-red-600"
                  : "border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs text-emerald-600"
              }
            >
              {playlist.visibility === "private" ? "Private" : "Public"}
            </span>
          </div>
          {playlist.description && <p className="mt-1 text-sm text-neutral-600">{playlist.description}</p>}
          <p className="mt-1 text-xs text-neutral-500" suppressHydrationWarning>
            Updated {formatRelativeTime(playlist.updatedAt)} · {playlist.clipCount} clip{playlist.clipCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {playlistClips.length === 0 ? (
        <LibraryEmptyState
          icon={ListVideo}
          title="No clips in this playlist yet"
          description="Assign a clip to this playlist from the Review page after recording, or add existing clips from the playlist's action menu."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {playlistClips.map((clip) => (
            <ClipListItem key={clip.id} clip={clip} />
          ))}
        </div>
      )}
    </div>
  );
};
export default PlaylistDetailPage;

const BackLink = () => {
  return (
    <Link href="/library/playlists" className="flex w-fit items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-black">
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to Playlists
    </Link>
  );
};
