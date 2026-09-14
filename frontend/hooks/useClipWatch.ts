"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { clipsApi, ApiError, type ApiClipWatch, type ApiWatchPlaylistItem, type ClipVisibility } from "@/lib/api-client";
import { hydrateTheaterClip } from "@/lib/editor/hydrate-theater-clip";
import type { ProjectMetadataPayload } from "@/types/project";

/**
 * Drives the single-Clip Watch page: fetches the bundled `/clips/<id>/watch/`
 * payload and hydrates it into the same `ProjectMetadataPayload` shape the
 * Playlist Theater already uses, so `VideoReviewPlayer` needs no clip-vs-
 * playlist special-casing. When the clip belongs to a playlist, also
 * resolves next/previous sibling ids for the context sidebar's queue and
 * for auto-advance — navigated via a real route change (`/clips/<id>/watch`
 * per clip) rather than swapped in place, since each clip owns its own URL.
 */
export function useClipWatch(clipId: string) {
  const [data, setData] = useState<ApiClipWatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    clipsApi.watch(clipId).then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setIsLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load this clip.");
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [clipId]);

  const project = useMemo<ProjectMetadataPayload | null>(
    () => (data ? hydrateTheaterClip(data, data.playlist_context?.id ?? null) : null),
    [data],
  );

  const updateVisibility = useCallback(
    async (visibility: ClipVisibility) => {
      const updated = await clipsApi.update(clipId, { visibility });
      setData((prev) => (prev ? { ...prev, visibility: updated.visibility, can_edit: updated.can_edit, is_owner: updated.is_owner } : prev));
    },
    [clipId],
  );

  const siblingItems: ApiWatchPlaylistItem[] = data?.playlist_context?.items ?? [];
  const currentIndex = siblingItems.findIndex((item) => item.id === clipId);
  const previousSibling = currentIndex > 0 ? siblingItems[currentIndex - 1] : null;
  const nextSibling = currentIndex >= 0 && currentIndex + 1 < siblingItems.length ? siblingItems[currentIndex + 1] : null;

  return {
    isLoading,
    error,
    clip: data,
    project,
    stepGuides: data?.step_guides ?? [],
    playlistContext: data?.playlist_context ?? null,
    relatedClips: data?.related_clips ?? [],
    previousClipId: previousSibling?.id ?? null,
    nextClipId: nextSibling?.id ?? null,
    updateVisibility,
  };
}
