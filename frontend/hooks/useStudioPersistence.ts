"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEditor } from "@/context/EditorContext";
import { indexedDbStorage } from "@/services/indexedDbStorage";
import type { TimelineClip } from "@/lib/editor/types";
import type { ImageOverlay } from "@/types/overlays";
import type { ImageOverlayDraft, ProjectDraft, SaveStatus, StorageQuotaEstimate, TimelineClipDraft } from "@/types/storage";

const AUTO_SAVE_DEBOUNCE_MS = 1500;

interface UseStudioPersistenceOptions {
  /** Stable id for this editing session's draft — a fresh recording's local project id, not a backend Clip id. */
  projectId: string;
  title: string;
  assignedPlaylistId?: string | null;
}

interface UseStudioPersistenceResult {
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  quota: StorageQuotaEstimate | null;
  errorMessage: string | null;
  /** True until the initial draft-restore attempt finishes — gate the editor's first paint on this to avoid a flash of an empty timeline. */
  isRestoring: boolean;
  saveNow: () => Promise<void>;
  discardDraft: () => Promise<void>;
}

/**
 * Connects `EditorContext` to the IndexedDB persistence layer:
 * - Debounced auto-save (1.5s after the last change) of the timeline — tracks,
 *   zoom/blur/text regions — plus the underlying recorded media as real Blobs.
 * - Auto-restore on mount: loads the newest local draft, re-hydrates its media
 *   into fresh object URLs, and repopulates the timeline via `loadProject`.
 * - Reactive save status and a live storage-quota estimate for the UI badge.
 *
 * This is independent from (and takes priority in-session over) resuming a
 * clip already saved to the backend via `/studio?clip=<id>` — that flow sets
 * `state.projectClipId` to a real Clip id, whereas a local draft restore here
 * always passes `clipId: null`, so "Done" in Review still *creates* a new
 * backend clip rather than mistakenly PATCHing one that doesn't exist there.
 */
export function useStudioPersistence({
  projectId,
  title,
  assignedPlaylistId = null,
}: UseStudioPersistenceOptions): UseStudioPersistenceResult {
  const { state, loadProject } = useEditor();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [quota, setQuota] = useState<StorageQuotaEstimate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);
  /** `src` (object/http URL) -> already-persisted media_blobs id, so split segments and
   *  repeated placements of the same source media are stored once, not duplicated. */
  const mediaIdBySrcRef = useRef<Map<string, string>>(new Map());
  /** Every object URL this hook has minted from restored Blobs, revoked together on unmount. */
  const restoredObjectUrlsRef = useRef<string[]>([]);

  const refreshQuota = useCallback(() => {
    indexedDbStorage.checkStorageQuota().then(setQuota, () => {
      // Non-fatal — the quota badge just won't show a number.
    });
  }, []);

  // ---- Auto-restore on mount -------------------------------------------------
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    let cancelled = false;

    indexedDbStorage
      .getProjectDraft(projectId)
      .then((matched) => matched ?? indexedDbStorage.getLatestDraft())
      .then(async (draft) => {
        if (cancelled || !draft) return;

        const urlByMediaId = new Map<string, string>();
        const resolveSrc = async (mediaId: string): Promise<string | null> => {
          const cached = urlByMediaId.get(mediaId);
          if (cached) return cached;
          const blob = await indexedDbStorage.getMediaBlob(mediaId);
          if (!blob) return null; // Media evicted or never finished saving — skip rather than break the whole restore.
          const src = URL.createObjectURL(blob);
          urlByMediaId.set(mediaId, src);
          restoredObjectUrlsRef.current.push(src);
          return src;
        };

        const tracks: TimelineClip[] = [];
        for (const trackDraft of draft.timeline.tracks) {
          const { mediaId, ...rest } = trackDraft;
          // Sequential on purpose — each lookup is a separate IDB read, fine at this scale.
          const src = await resolveSrc(mediaId);
          if (src) tracks.push({ ...rest, src });
        }

        const imageOverlays: ImageOverlay[] = [];
        for (const overlayDraft of draft.timeline.imageOverlays ?? []) {
          const { mediaId, ...rest } = overlayDraft;
          const src = await resolveSrc(mediaId);
          if (src) imageOverlays.push({ ...rest, src });
        }

        if (cancelled) return;
        loadProject({
          clipId: null,
          tracks,
          zoomRegions: draft.timeline.zoomRegions,
          blurRegions: draft.timeline.blurRegions,
          textRegions: draft.timeline.textRegions,
          imageOverlays,
          cuts: draft.timeline.cuts,
          filters: draft.timeline.filters,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Couldn't restore your last session.");
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore is mount-only, keyed by the stable projectId
  }, [projectId]);

  // Revoke every object URL this hook minted, on unmount (or project switch) only —
  // not on every render, since the editor keeps using these URLs while mounted.
  useEffect(() => {
    return () => {
      restoredObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      restoredObjectUrlsRef.current = [];
    };
  }, [projectId]);

  const resolveMediaId = useCallback(async (src: string, duration: number): Promise<string> => {
    const cached = mediaIdBySrcRef.current.get(src);
    if (cached) return cached;

    const blob = await fetch(src).then((response) => response.blob());
    const mediaId = `media_${crypto.randomUUID()}`;
    await indexedDbStorage.saveMediaBlob(mediaId, blob, duration);
    mediaIdBySrcRef.current.set(src, mediaId);
    return mediaId;
  }, []);

  const persistDraft = useCallback(async () => {
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const trackDrafts: TimelineClipDraft[] = [];
      for (const clip of state.tracks) {
        // Sequential on purpose — each clip's blob must finish saving before the draft references its id.
        const mediaId = await resolveMediaId(clip.src, clip.duration);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit `src` from the rest
        const { src, ...rest } = clip;
        trackDrafts.push({ ...rest, mediaId });
      }

      const overlayDrafts: ImageOverlayDraft[] = [];
      for (const overlay of state.imageOverlays) {
        const mediaId = await resolveMediaId(overlay.src, 0);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit `src` from the rest
        const { src, ...rest } = overlay;
        overlayDrafts.push({ ...rest, mediaId });
      }

      const now = new Date().toISOString();
      const draft: ProjectDraft = {
        id: projectId,
        title,
        status: "draft",
        assignedPlaylistId,
        timeline: {
          tracks: trackDrafts,
          canvasAspectRatio: state.canvasAspectRatio,
          zoomRegions: state.zoomRegions,
          blurRegions: state.blurRegions,
          textRegions: state.textRegions,
          imageOverlays: overlayDrafts,
          cuts: state.cuts,
          filters: state.filters,
        },
        mediaIds: [...new Set([...trackDrafts.map((track) => track.mediaId), ...overlayDrafts.map((overlay) => overlay.mediaId)])],
        createdAt: now,
        updatedAt: now,
      };

      await indexedDbStorage.saveProjectDraft(draft);
      setSaveStatus("saved");
      setLastSavedAt(draft.updatedAt);
      refreshQuota();
    } catch (error) {
      const isQuotaError = error instanceof DOMException && error.name === "QuotaExceededError";
      setSaveStatus("error");
      setErrorMessage(
        isQuotaError
          ? "Local storage is full — free up device space to keep auto-saving your recording."
          : "Couldn't save your changes locally.",
      );
    }
  }, [
    state.tracks,
    state.imageOverlays,
    state.canvasAspectRatio,
    state.zoomRegions,
    state.blurRegions,
    state.textRegions,
    state.cuts,
    state.filters,
    projectId,
    title,
    assignedPlaylistId,
    resolveMediaId,
    refreshQuota,
  ]);

  // ---- Debounced auto-save on timeline/overlay changes -----------------------
  useEffect(() => {
    if (isRestoring) return; // Don't save over the draft mid-restore, or save an empty timeline before it loads.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persistDraft();
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    state.tracks,
    state.zoomRegions,
    state.blurRegions,
    state.textRegions,
    state.imageOverlays,
    state.cuts,
    state.filters,
    isRestoring,
    persistDraft,
  ]);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  const saveNow = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await persistDraft();
  }, [persistDraft]);

  const discardDraft = useCallback(async () => {
    await indexedDbStorage.deleteProjectDraft(projectId);
    setSaveStatus("idle");
    setLastSavedAt(null);
  }, [projectId]);

  return { saveStatus, lastSavedAt, quota, errorMessage, isRestoring, saveNow, discardDraft };
}
