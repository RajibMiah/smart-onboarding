"use client";

import { useCallback, useEffect, useState } from "react";

import { playlistItemsApi, playlistsApi, ApiError, type ApiPlaylist } from "@/lib/api-client";
import type { Playlist, PlaylistVisibility } from "@/types/playlist";

const toPlaylist = (playlist: ApiPlaylist): Playlist => {
  const orderedClipIds = [...playlist.items].sort((a, b) => a.position - b.position).map((item) => item.clip);
  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description || undefined,
    clipCount: playlist.items.length,
    thumbnailUrl: null,
    visibility: playlist.visibility,
    updatedAt: playlist.updated_at,
    createdAt: playlist.created_at,
    clipIds: orderedClipIds,
  };
};

/** Real-backend replacement for the old `playlist-mock-data.ts` store. */
export const usePlaylists = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await playlistsApi.list({ ordering: "-updated_at" });
      setPlaylists(page.results.map(toPlaylist));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load playlists.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    playlistsApi.list({ ordering: "-updated_at" }).then(
      (page) => {
        if (cancelled) return;
        setPlaylists(page.results.map(toPlaylist));
        setError(null);
        setIsLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load playlists.");
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const createPlaylist = useCallback(
    async (input: { title: string; description?: string; visibility: PlaylistVisibility }) => {
      const created = await playlistsApi.create({
        title: input.title,
        description: input.description,
        visibility: input.visibility,
      });
      const playlist = toPlaylist(created);
      setPlaylists((prev) => [playlist, ...prev]);
      return playlist;
    },
    [],
  );

  const addClipToPlaylist = useCallback(
    async (playlistId: string, clipId: string) => {
      // Re-saving a clip (retrying after a partial failure, or editing one
      // that's already published into this same playlist) would otherwise
      // re-POST a (playlist, clip) pair that's already there, and the
      // backend's unique-together constraint rejects it with a raw
      // "The fields playlist, clip must make a unique set." error — already
      // being a member is the desired end state, not a failure, so treat it
      // as a no-op both when we already know about it locally...
      const alreadyMember = playlists.some(
        (playlist) => playlist.id === playlistId && playlist.clipIds.includes(clipId),
      );
      if (alreadyMember) return;

      try {
        const created = await playlistItemsApi.create({ playlist: playlistId, clip: clipId });
        setPlaylists((prev) =>
          prev.map((playlist) =>
            playlist.id === playlistId && !playlist.clipIds.includes(clipId)
              ? {
                  ...playlist,
                  clipIds: [...playlist.clipIds, created.clip],
                  clipCount: playlist.clipCount + 1,
                  updatedAt: new Date().toISOString(),
                }
              : playlist,
          ),
        );
      } catch (error) {
        // ...and when our local copy was stale and the backend is the one
        // that discovers the pair already exists.
        const isDuplicateMembership =
          error instanceof ApiError && error.status === 400 && Boolean(error.fieldErrors?.non_field_errors);
        if (!isDuplicateMembership) throw error;
      }
    },
    [playlists],
  );

  const renamePlaylist = useCallback(async (id: string, title: string) => {
    setPlaylists((prev) => prev.map((playlist) => (playlist.id === id ? { ...playlist, title } : playlist)));
    try {
      await playlistsApi.update(id, { title });
    } catch {
      // best-effort optimistic update; a manual refresh will reconcile
    }
  }, []);

  const setPlaylistVisibility = useCallback(async (id: string, visibility: PlaylistVisibility) => {
    setPlaylists((prev) => prev.map((playlist) => (playlist.id === id ? { ...playlist, visibility } : playlist)));
    try {
      await playlistsApi.update(id, { visibility });
    } catch {
      // best-effort optimistic update; a manual refresh will reconcile
    }
  }, []);

  const duplicatePlaylist = useCallback(
    async (id: string) => {
      const source = playlists.find((playlist) => playlist.id === id);
      if (!source) return;
      const created = await playlistsApi.create({
        title: `${source.title} (copy)`,
        description: source.description,
        visibility: source.visibility,
      });
      let playlist = toPlaylist(created);
      for (const clipId of source.clipIds) {
        // Sequential on purpose — playlist items must be created in order to preserve position.
        const item = await playlistItemsApi.create({ playlist: playlist.id, clip: clipId });
        playlist = { ...playlist, clipIds: [...playlist.clipIds, item.clip], clipCount: playlist.clipCount + 1 };
      }
      setPlaylists((prev) => [playlist, ...prev]);
    },
    [playlists],
  );

  const removePlaylist = useCallback(
    async (id: string) => {
      const previous = playlists;
      setPlaylists((prev) => prev.filter((playlist) => playlist.id !== id));
      try {
        await playlistsApi.remove(id);
      } catch {
        setPlaylists(previous);
      }
    },
    [playlists],
  );

  return {
    playlists,
    isLoading,
    error,
    refresh,
    createPlaylist,
    addClipToPlaylist,
    renamePlaylist,
    setPlaylistVisibility,
    duplicatePlaylist,
    removePlaylist,
  };
};
