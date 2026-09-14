"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { playlistsApi, ApiError, type ApiStepGuide, type ClipStatus, type ClipVisibility } from "@/lib/api-client";
import { hydrateTheaterClip } from "@/lib/editor/hydrate-theater-clip";
import type { ProjectMetadataPayload } from "@/types/project";

export interface TheaterClipSummary {
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  authorName: string;
  visibility: ClipVisibility;
  status: ClipStatus;
  stepGuideCount: number;
}

/**
 * Owns the Playlist Theater's whole playback queue: fetches the bundled
 * `/playlists/<id>/theater/` payload once, then drives which clip is active
 * and hydrates its full non-destructive edit layers into the same
 * `ProjectMetadataPayload` shape `VideoReviewPlayer` already renders.
 */
export function usePlaylistTheater(playlistId: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof playlistsApi.theater>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await playlistsApi.theater(playlistId);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this playlist.");
    } finally {
      setIsLoading(false);
    }
  }, [playlistId]);

  // Duplicates `refresh`'s body instead of calling it: every setState call
  // below happens inside the `.then` callbacks, which fire asynchronously
  // after the effect body itself has already finished running — calling
  // `refresh()` directly here would set off the same lint rule that flags
  // any *synchronous* setState during an effect's execution.
  useEffect(() => {
    let cancelled = false;
    playlistsApi.theater(playlistId).then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setIsLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load this playlist.");
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  const orderedItems = useMemo(() => (data ? [...data.items].sort((a, b) => a.position - b.position) : []), [data]);

  const clips = useMemo<TheaterClipSummary[]>(
    () =>
      orderedItems.map((item) => ({
        id: item.clip.id,
        title: item.clip.title,
        thumbnailUrl: item.clip.thumbnail_url,
        durationSeconds: Number(item.clip.duration_seconds) || 0,
        authorName: item.clip.author_name,
        visibility: item.clip.visibility,
        status: item.clip.status,
        stepGuideCount: item.clip.step_guides.length,
      })),
    [orderedItems],
  );

  // Clamp back to the first clip if the active index falls off the end (e.g.
  // the playlist shrank from underneath this session). Adjusted during
  // render rather than in an effect — React's documented pattern for
  // resetting state in response to a value that changed this same render,
  // tracked via `lastClipsCount` so it only fires on an actual change.
  const [lastClipsCount, setLastClipsCount] = useState(clips.length);
  if (clips.length !== lastClipsCount) {
    setLastClipsCount(clips.length);
    if (clips.length > 0 && currentClipIndex >= clips.length) setCurrentClipIndex(0);
  }

  const currentItem = orderedItems[currentClipIndex] ?? null;
  const currentClip = clips[currentClipIndex] ?? null;

  const currentProject = useMemo<ProjectMetadataPayload | null>(
    () => (currentItem ? hydrateTheaterClip(currentItem.clip, playlistId) : null),
    [currentItem, playlistId],
  );

  const currentStepGuides = useMemo<ApiStepGuide[]>(
    () => [...(currentItem?.clip.step_guides ?? [])].sort((a, b) => a.step_number - b.step_number),
    [currentItem],
  );

  const totalDurationSeconds = useMemo(() => clips.reduce((sum, clip) => sum + clip.durationSeconds, 0), [clips]);

  const selectClip = useCallback(
    (index: number) => {
      if (index >= 0 && index < clips.length) setCurrentClipIndex(index);
    },
    [clips.length],
  );

  const nextClip = useCallback(() => {
    setCurrentClipIndex((prev) => (prev + 1 < clips.length ? prev + 1 : prev));
  }, [clips.length]);

  const prevClip = useCallback(() => {
    setCurrentClipIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const reorderClips = useCallback(
    async (orderedClipIds: string[]) => {
      const activeClipId = clips[currentClipIndex]?.id;
      setIsReordering(true);
      setReorderError(null);
      try {
        const result = await playlistsApi.reorder(playlistId, orderedClipIds);
        setData(result);
        if (activeClipId) {
          const nextIndex = [...result.items]
            .sort((a, b) => a.position - b.position)
            .findIndex((item) => item.clip.id === activeClipId);
          if (nextIndex >= 0) setCurrentClipIndex(nextIndex);
        }
      } catch (err) {
        setReorderError(err instanceof ApiError ? err.message : "Couldn't reorder this playlist.");
      } finally {
        setIsReordering(false);
      }
    },
    [playlistId, clips, currentClipIndex],
  );

  return {
    isLoading,
    error,
    refresh,
    playlistTitle: data?.title ?? "",
    playlistDescription: data?.description ?? "",
    playlistVisibility: data?.visibility ?? ("private" as const),
    ownerId: data?.owner ?? null,
    canEdit: data?.can_edit ?? false,
    isOwner: data?.is_owner ?? false,
    ownerName: data?.owner_name ?? "",
    ownerDepartment: data?.owner_department ?? null,
    ownerTeam: data?.owner_team ?? null,
    clips,
    currentClipIndex,
    currentClip,
    currentProject,
    currentStepGuides,
    totalDurationSeconds,
    selectClip,
    nextClip,
    prevClip,
    hasNext: currentClipIndex + 1 < clips.length,
    hasPrev: currentClipIndex > 0,
    reorderClips,
    isReordering,
    reorderError,
  };
}

export type UsePlaylistTheaterResult = ReturnType<typeof usePlaylistTheater>;
