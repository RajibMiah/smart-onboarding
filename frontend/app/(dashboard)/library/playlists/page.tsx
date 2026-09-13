"use client";

import { useCallback, useState } from "react";
import { ListVideo } from "lucide-react";

import { LibraryEmptyState } from "@/components/library/LibraryEmptyState";
import { PlaylistListItem } from "@/components/library/PlaylistListItem";
import { ShareModal } from "@/components/library/ShareModal";
import { NEW_PLAYLIST_MODAL_ID, NewPlaylistModal } from "@/components/modals/NewPlaylistModal";
import { EditorialFilterBar } from "@/components/ui/EditorialFilterBar";
import { Toast } from "@/components/ui/Toast";
import { useClips } from "@/hooks/useClips";
import { useModal } from "@/hooks/useModal";
import { usePlaylistFilter } from "@/hooks/usePlaylistFilter";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useToast } from "@/hooks/useToast";
import { PLAYLIST_SORT_OPTIONS, PLAYLIST_VISIBILITY_OPTIONS, type PlaylistSortOption, type PlaylistVisibilityFilter } from "@/types/playlist";

const PlaylistsLibraryPage = () => {
  const toast = useToast();
  const newPlaylistModal = useModal(NEW_PLAYLIST_MODAL_ID);
  const {
    playlists,
    isLoading,
    error,
    createPlaylist,
    renamePlaylist,
    setPlaylistVisibility,
    duplicatePlaylist,
    removePlaylist,
  } = usePlaylists();
  const { clips } = useClips();
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);

  const filter = usePlaylistFilter({ playlists });

  const handleRename = useCallback(
    (id: string, currentTitle: string) => {
      const next = window.prompt("Rename playlist", currentTitle)?.trim();
      if (!next) return;
      void renamePlaylist(id, next);
    },
    [renamePlaylist],
  );

  const handleChangeVisibility = useCallback(
    (id: string, current: "public" | "private") => {
      void setPlaylistVisibility(id, current === "public" ? "private" : "public");
    },
    [setPlaylistVisibility],
  );

  const hasAnyPlaylists = playlists.length > 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-black">Playlists</h1>
        <button
          type="button"
          onClick={newPlaylistModal.open}
          className="cursor-pointer border border-black px-3 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-400"
        >
          + New Playlist
        </button>
      </div>

      <EditorialFilterBar
        search={filter.search}
        onSearchChange={filter.setSearch}
        searchPlaceholder="Search for..."
        selects={[
          {
            id: "sort",
            label: "Sort by",
            value: filter.sort,
            options: PLAYLIST_SORT_OPTIONS,
            onChange: (value) => filter.setSort(value as PlaylistSortOption),
          },
          {
            id: "visibility",
            label: "Visibility",
            value: filter.visibility,
            options: PLAYLIST_VISIBILITY_OPTIONS,
            onChange: (value) => filter.setVisibility(value as PlaylistVisibilityFilter),
          },
        ]}
      />

      <p className="text-xs text-neutral-500">
        {isLoading ? "Loading playlists…" : `Showing ${filter.items.length} of ${filter.totalCount} playlists`}
      </p>

      {error && (
        <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && filter.items.length === 0 ? (
        <LibraryEmptyState
          icon={ListVideo}
          title={hasAnyPlaylists ? "No playlists match your search" : "No playlists yet"}
          description={
            hasAnyPlaylists
              ? 'Try a different search term or switch the filter to "All".'
              : "Group clips into a playlist your team can watch in order."
          }
          actionLabel={hasAnyPlaylists ? undefined : "+ New Playlist"}
          onAction={hasAnyPlaylists ? undefined : newPlaylistModal.open}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filter.items.map((playlist) => {
            const firstClip = clips.find((clip) => clip.id === playlist.clipIds[0]);
            const totalDurationSeconds = playlist.clipIds.reduce((sum, clipId) => {
              const clip = clips.find((item) => item.id === clipId);
              return sum + (clip?.durationSeconds ?? 0);
            }, 0);

            return (
              <PlaylistListItem
                key={playlist.id}
                playlist={playlist}
                firstThumbnailUrl={firstClip?.thumbnailUrl}
                totalDurationSeconds={totalDurationSeconds}
                onAddClips={() => toast.show("Adding existing clips to a playlist isn't available in this preview yet.")}
                onRename={() => handleRename(playlist.id, playlist.title)}
                onChangeVisibility={() => handleChangeVisibility(playlist.id, playlist.visibility)}
                onDuplicate={() => void duplicatePlaylist(playlist.id)}
                onDelete={() => void removePlaylist(playlist.id)}
                onShare={() => setShareTarget({ id: playlist.id, title: playlist.title })}
              />
            );
          })}
        </div>
      )}

      <NewPlaylistModal
        onCreate={({ title, description, visibility }) => {
          void createPlaylist({ title, description, visibility }).then(() => {
            toast.show(`"${title}" playlist created.`);
          });
        }}
      />

      {toast.message && <Toast message={toast.message} />}

      <ShareModal
        isOpen={shareTarget !== null}
        onClose={() => setShareTarget(null)}
        contentType="playlist"
        objectId={shareTarget?.id ?? ""}
        contentTitle={shareTarget?.title ?? ""}
      />
    </div>
  );
};
export default PlaylistsLibraryPage;
