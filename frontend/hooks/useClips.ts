"use client";

import { useCallback, useEffect, useState } from "react";

import { clipsApi, ApiError, type ApiClip, type ClipVisibility } from "@/lib/api-client";
import type { ClipItem } from "@/types/library";

const slugify = (seed: string): string => {
  const base = seed
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "clip"}-${Date.now().toString(36)}`;
};

const toClipItem = (clip: ApiClip): ClipItem => {
  return {
    id: clip.id,
    title: clip.title,
    thumbnailUrl: clip.thumbnail_url || undefined,
    videoUrl: clip.assets.find((asset) => asset.asset_type === "video")?.file_url || undefined,
    durationSeconds: Math.round(Number(clip.duration_seconds)),
    status: clip.visibility === "published" ? "published" : "draft",
    visibility: clip.visibility,
    createdAt: clip.created_at,
    updatedAt: clip.updated_at,
    views: 0,
    likes: 0,
    comments: 0,
    canEdit: clip.can_edit,
    isOwner: clip.is_owner,
    playlistCount: clip.playlist_count,
  };
};

/** Real-backend replacement for the old `library-mock-data.ts` clips store. */
export const useClips = () => {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await clipsApi.list({ ordering: "-updated_at" });
      setClips(page.results.map(toClipItem));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load clips.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    clipsApi.list({ ordering: "-updated_at" }).then(
      (page) => {
        if (cancelled) return;
        setClips(page.results.map(toClipItem));
        setError(null);
        setIsLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load clips.");
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const createClip = useCallback(
    async (input: { title: string; durationSeconds?: number; visibility?: ClipVisibility }) => {
      const created = await clipsApi.create({
        title: input.title,
        slug: slugify(input.title),
        duration_seconds: input.durationSeconds ?? 0,
        status: "completed",
        visibility: input.visibility ?? "draft",
      });
      const item = toClipItem(created);
      setClips((prev) => [item, ...prev]);
      return item;
    },
    [],
  );

  const removeClip = useCallback(
    async (id: string) => {
      const previous = clips;
      setClips((prev) => prev.filter((clip) => clip.id !== id));
      try {
        await clipsApi.remove(id);
      } catch {
        setClips(previous);
      }
    },
    [clips],
  );

  const duplicateClip = useCallback(
    async (id: string) => {
      const source = clips.find((clip) => clip.id === id);
      if (!source) return;
      const created = await clipsApi.create({
        title: `${source.title} (copy)`,
        slug: slugify(`${source.title}-copy`),
        duration_seconds: source.durationSeconds,
        status: "completed",
        visibility: "draft",
      });
      setClips((prev) => [toClipItem(created), ...prev]);
    },
    [clips],
  );

  const renameClip = useCallback(async (id: string, title: string) => {
    setClips((prev) => prev.map((clip) => (clip.id === id ? { ...clip, title } : clip)));
    try {
      await clipsApi.update(id, { title });
    } catch {
      // best-effort optimistic update; a manual refresh will reconcile
    }
  }, []);

  const updateClipVisibility = useCallback(async (id: string, visibility: ClipVisibility) => {
    const previous = clips;
    setClips((prev) =>
      prev.map((clip) => (clip.id === id ? { ...clip, visibility, status: visibility === "published" ? "published" : "draft" } : clip)),
    );
    try {
      await clipsApi.update(id, { visibility });
    } catch {
      setClips(previous);
      throw new Error("Couldn't update this clip's visibility.");
    }
  }, [clips]);

  const updateClipThumbnail = useCallback(async (id: string, file: Blob) => {
    const updated = await clipsApi.uploadThumbnail(id, file);
    setClips((prev) => prev.map((clip) => (clip.id === id ? toClipItem(updated) : clip)));
  }, []);

  return {
    clips,
    isLoading,
    error,
    refresh,
    createClip,
    removeClip,
    duplicateClip,
    renameClip,
    updateClipVisibility,
    updateClipThumbnail,
  };
};
