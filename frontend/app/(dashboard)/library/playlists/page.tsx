"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ListVideo } from "lucide-react";

import { LibraryEmptyState } from "@/components/library/LibraryEmptyState";
import { PlaylistListItem } from "@/components/library/PlaylistListItem";
import { NEW_PLAYLIST_MODAL_ID, NewPlaylistModal } from "@/components/modals/NewPlaylistModal";
import { EditorialFilterBar } from "@/components/ui/EditorialFilterBar";
import { Toast } from "@/components/ui/Toast";
import { useModal } from "@/hooks/useModal";
import { usePlaylistFilter } from "@/hooks/usePlaylistFilter";
import { useToast } from "@/hooks/useToast";
import { getClipsSnapshot, subscribeToClips } from "@/lib/library-mock-data";
import {
  addPlaylist,
  duplicatePlaylist,
  getPlaylistsSnapshot,
  removePlaylist,
  renamePlaylist,
  setPlaylistVisibility,
  subscribeToPlaylists,
} from "@/lib/playlist-mock-data";
import { PLAYLIST_SORT_OPTIONS, PLAYLIST_VISIBILITY_OPTIONS, type PlaylistSortOption, type PlaylistVisibilityFilter } from "@/types/playlist";

export default function PlaylistsLibraryPage() {
  const toast = useToast();
  const newPlaylistModal = useModal(NEW_PLAYLIST_MODAL_ID);
  const playlists = useSyncExternalStore(subscribeToPlaylists, getPlaylistsSnapshot, getPlaylistsSnapshot);
  const clips = useSyncExternalStore(subscribeToClips, getClipsSnapshot, getClipsSnapshot);

  const filter = usePlaylistFilter({ playlists });

  const handleRename = useCallback((id: string, currentTitle: string) => {
    const next = window.prompt("Rename playlist", currentTitle)?.trim();
    if (!next) return;
    renamePlaylist(id, next);
  }, []);

  const handleChangeVisibility = useCallback((id: string, current: "public" | "private") => {
    setPlaylistVisibility(id, current === "public" ? "private" : "public");
  }, []);

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
        Showing {filter.items.length} of {filter.totalCount} playlists
      </p>

      {filter.items.length === 0 ? (
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
                onDuplicate={() => duplicatePlaylist(playlist.id)}
                onDelete={() => removePlaylist(playlist.id)}
              />
            );
          })}
        </div>
      )}

      <NewPlaylistModal
        onCreate={({ title, description, visibility }) => {
          addPlaylist({ title, description, visibility });
          toast.show(`"${title}" playlist created.`);
        }}
      />

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
}
