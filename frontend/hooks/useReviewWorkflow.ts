"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useEditor } from "@/context/EditorContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import {
  blurRegionsApi,
  clipsApi,
  cutsApi,
  mediaAssetsApi,
  textOverlaysApi,
  timelineTracksApi,
  zoomRegionsApi,
  ApiError,
} from "@/lib/api-client";
import { captureVideoFrame } from "@/lib/editor/capture-frame";
import { cacheClipForOfflineEditing } from "@/lib/editor/project-cache";
import { clearLocalProjectId, getOrCreateLocalProjectId } from "@/lib/editor/project-defaults";
import indexedDbStorage from "@/services/indexedDbStorage";
import type { DocumentationStep, ProcessingStatus } from "@/types/review";

/** Simulated processing delay — there's no real transcoding backend yet. */
const PROCESSING_DURATION_MS = 3000;

/**
 * Backend region fields are fixed-precision DecimalFields (x/y/width/height:
 * max_digits=5, decimal_places=2; scale_factor: max_digits=4, decimal_places=2;
 * start/end time: decimal_places=3) — `String(someFloat)` can produce far more
 * digits than that (e.g. "83.33333333333334" from a bounds ratio × 100),
 * which the API rejects with "Ensure that there are no more than N digits in
 * total." Rounding to the same precision here keeps every save in bounds.
 */
const toDecimalString = (value: number, decimalPlaces: number): string => value.toFixed(decimalPlaces);

const slugify = (seed: string): string => {
  const base = seed
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "clip"}-${Date.now().toString(36)}`;
};

interface UseReviewWorkflowOptions {
  initialTitle: string;
  /** Whether there's actually a clip to review — drives processing vs. the empty state. */
  hasMedia: boolean;
}

/**
 * Owns the whole Review & Publish page's state, per `types/review.ts`.
 * Playlists come from the same real backend the `/library/playlists` page
 * reads/writes, so assigning one here for real links the saved clip into it.
 *
 * When the Studio session was opened to resume an existing clip (`state.projectClipId`
 * set by `EditorContext.loadProject`), this hook seeds the real title/description/
 * visibility from the backend, and `handleSaveAndFinish` updates that same clip in
 * place — replacing its media assets and overlay tracks — instead of creating a new one.
 */
export const useReviewWorkflow = ({ initialTitle, hasMedia }: UseReviewWorkflowOptions) => {
  const router = useRouter();
  const { playlists, isLoading: isLoadingPlaylists, createPlaylist, addClipToPlaylist } = usePlaylists();
  const { state, videoClips } = useEditor();
  const existingClipId = state.projectClipId;

  const [projectTitle, setProjectTitle] = useState(initialTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  // "error" (no media) is derived at render time below rather than stored —
  // only the processing->ready transition needs state, since it's driven by
  // a timer rather than something computable from props on every render.
  const [timedStatus, setTimedStatus] = useState<"processing" | "ready">("processing");
  const [isPublished, setIsPublished] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  /** The playlist this clip was already in when Review opened — null once
   *  determined if it wasn't in any (or there's no existing clip at all).
   *  `undefined` means "not looked up yet", so the pre-select effect below
   *  only runs once, on the first successful lookup. */
  const [originalPlaylistId, setOriginalPlaylistId] = useState<string | null | undefined>(undefined);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<DocumentationStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  /** Set once a clip is created within this session, so retrying after a failed
   *  media upload updates that same clip instead of creating an orphaned duplicate. */
  const pendingClipIdRef = useRef<string | null>(null);

  const processingStatus: ProcessingStatus = hasMedia ? timedStatus : "error";

  useEffect(() => {
    // Initial state is already "processing" — this only needs to schedule
    // the transition to "ready", not set the starting value.
    if (!hasMedia) return;
    const timer = setTimeout(() => setTimedStatus("ready"), PROCESSING_DURATION_MS);
    return () => clearTimeout(timer);
  }, [hasMedia]);

  useEffect(() => {
    if (!existingClipId) return;
    let cancelled = false;
    clipsApi.get(existingClipId).then(
      (clip) => {
        if (cancelled) return;
        setProjectTitle(clip.title);
        setDescription(clip.description);
        setIsPublished(clip.visibility === "published");
      },
      () => {
        // Non-fatal: the session still works, just starts from the generated defaults.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [existingClipId]);

  // Determines which playlist (if any) this clip was already assigned to,
  // once the playlist list has loaded — the "same playlist" vs. "different
  // playlist" branch in handleSaveAndFinish depends on knowing this. Runs
  // once per resumed clip: `originalPlaylistId` starts `undefined` (not yet
  // looked up) and is only set the first time `playlists` is non-empty, so a
  // later playlist-list refresh doesn't silently redefine "original".
  useEffect(() => {
    if (!existingClipId || originalPlaylistId !== undefined || isLoadingPlaylists) return;
    const owner = playlists.find((playlist) => playlist.clipIds.includes(existingClipId));
    setOriginalPlaylistId(owner?.id ?? null);
    if (owner) setSelectedPlaylistId((prev) => prev ?? owner.id);
  }, [existingClipId, playlists, isLoadingPlaylists, originalPlaylistId]);

  const startEditingTitle = useCallback(() => setIsEditingTitle(true), []);
  const commitTitle = useCallback((next: string) => {
    setProjectTitle((prev) => next.trim() || prev);
    setIsEditingTitle(false);
  }, []);

  const selectPlaylist = useCallback((id: string) => {
    setSelectedPlaylistId(id);
    setPlaylistError(null);
  }, []);

  const createQuickPlaylist = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      // Quick-create defaults to private — the full Playlists page's own "+ New
      // Playlist" modal is where visibility gets asked explicitly.
      const playlist = await createPlaylist({ title: trimmed, visibility: "private" });
      setSelectedPlaylistId(playlist.id);
      setPlaylistError(null);
    },
    [createPlaylist],
  );

  const addStep = useCallback((timestamp: number) => {
    setSteps((prev) => [...prev, { id: crypto.randomUUID(), timestamp, title: "", content: "" }]);
  }, []);

  const updateStep = useCallback((id: string, changes: Partial<Omit<DocumentationStep, "id">>) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, ...changes } : step)));
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
  }, []);

  const handleSaveAndFinish = useCallback(
    async (durationSeconds: number, options?: { forceNew?: boolean }) => {
      // Belt-and-braces against the Done button firing twice concurrently
      // (e.g. a fast double-click before the disabled state paints) — two
      // overlapping saves racing to add the same clip to the same playlist
      // is exactly what produced the backend's unique-together error.
      if (isSaving) return;
      if (!selectedPlaylistId) {
        setPlaylistError("A playlist assignment is required to save to library.");
        return;
      }
      setIsSaving(true);
      try {
        const clipPayload = {
          title: projectTitle,
          slug: slugify(projectTitle),
          description,
          duration_seconds: Math.round(durationSeconds),
          status: "completed" as const,
          visibility: isPublished ? ("published" as const) : ("draft" as const),
          filter_settings: state.filters,
        };

        let clipId: string;
        // Saving into a different playlist than the one this clip already
        // belongs to forks it into an independent clip instead of overwriting
        // — `forceNew` skips reusing `existingClipId`/`pendingClipIdRef` so
        // the block below falls into the plain-create branch, leaving the
        // original clip (and its other playlist's reference to it) untouched.
        const targetClipId = options?.forceNew ? null : (existingClipId ?? pendingClipIdRef.current);
        if (targetClipId) {
          // Re-editing a saved clip (or retrying after a previous attempt's media
          // upload failed): replace its old assets/overlay tracks rather than
          // accumulating duplicates, or orphaning a video-less clip, on every save.
          const existing = await clipsApi.get(targetClipId);
          await clipsApi.update(targetClipId, clipPayload);
          await Promise.all(existing.assets.map((asset) => mediaAssetsApi.remove(asset.id)));
          const existingTracks = await timelineTracksApi.listByClip(targetClipId);
          await Promise.all(existingTracks.results.map((track) => timelineTracksApi.remove(track.id)));
          clipId = targetClipId;
        } else {
          const created = await clipsApi.create(clipPayload);
          clipId = created.id;
          pendingClipIdRef.current = clipId;
        }

        const primaryClip = videoClips[0];
        if (primaryClip) {
          // Not wrapped in its own try/catch — a failed video upload must not be
          // reported as a successful save. It propagates to the outer catch below,
          // which surfaces the error and keeps the clip id above for a clean retry.
          const videoBlob = await fetch(primaryClip.src).then((response) => response.blob());
          await mediaAssetsApi.upload({ clip: clipId, asset_type: "video", file: videoBlob });

          try {
            const thumbnailBlob = await captureVideoFrame(primaryClip.src, 0.1, {
              cuts: state.cuts,
              filters: state.filters,
            });
            await clipsApi.uploadThumbnail(clipId, thumbnailBlob);
          } catch {
            // Thumbnail generation is best-effort — a missing thumbnail doesn't affect playback.
          }
        }

        // `TimelineTrack` enforces one `order` per clip (`UniqueConstraint(clip,
        // order)`) — omitting it left every track defaulting to 0, so a clip
        // with more than one edit type (e.g. zoom *and* text) collided on its
        // second track with "The fields clip, order must make a unique set."
        let nextTrackOrder = 0;
        const persistRegions = async (
          trackType: "zoom" | "blur" | "text" | "cut",
          count: number,
          createRegion: (trackId: string) => Promise<unknown>,
        ) => {
          if (count === 0) return;
          const track = await timelineTracksApi.create({ clip: clipId, track_type: trackType, order: nextTrackOrder++ });
          await createRegion(track.id);
        };

        await persistRegions("zoom", state.zoomRegions.length, (trackId) =>
          Promise.all(
            state.zoomRegions.map((region) =>
              zoomRegionsApi.create({
                track: trackId,
                x: toDecimalString(region.bounds.x * 100, 2),
                y: toDecimalString(region.bounds.y * 100, 2),
                width: toDecimalString(region.bounds.width * 100, 2),
                height: toDecimalString(region.bounds.height * 100, 2),
                scale_factor: toDecimalString(region.scale, 2),
                start_time: toDecimalString(region.startTime, 3),
                end_time: toDecimalString(region.endTime, 3),
              }),
            ),
          ),
        );

        await persistRegions("blur", state.blurRegions.length, (trackId) =>
          Promise.all(
            state.blurRegions.map((region) =>
              blurRegionsApi.create({
                track: trackId,
                x: toDecimalString(region.bounds.x * 100, 2),
                y: toDecimalString(region.bounds.y * 100, 2),
                width: toDecimalString(region.bounds.width * 100, 2),
                height: toDecimalString(region.bounds.height * 100, 2),
                shape: region.shape,
                blur_radius: region.blurRadius,
                start_time: toDecimalString(region.startTime, 3),
                end_time: toDecimalString(region.endTime, 3),
              }),
            ),
          ),
        );

        await persistRegions("text", state.textRegions.length, (trackId) =>
          Promise.all(
            state.textRegions.map((region) =>
              textOverlaysApi.create({
                track: trackId,
                content: region.content,
                position_x: toDecimalString(region.bounds.x * 100, 2),
                position_y: toDecimalString(region.bounds.y * 100, 2),
                font_size: region.style.fontSize,
                color: region.style.textColor,
                background_color: region.style.backgroundColor,
                start_time: toDecimalString(region.startTime, 3),
                end_time: toDecimalString(region.endTime, 3),
              }),
            ),
          ),
        );

        await persistRegions("cut", state.cuts.length, (trackId) =>
          Promise.all(
            state.cuts.map((cut) =>
              cutsApi.create({
                track: trackId,
                cut_type: cut.type,
                speed_multiplier: cut.speedMultiplier != null ? toDecimalString(cut.speedMultiplier, 2) : null,
                start_time: toDecimalString(cut.startTime, 3),
                end_time: toDecimalString(cut.endTime, 3),
              }),
            ),
          ),
        );

        await addClipToPlaylist(selectedPlaylistId, clipId);

        // Bidirectional persistence: the backend save above is the source of
        // truth, but a local mirror is what lets this same clip reopen for
        // editing (or just play back) without the network per the re-editing
        // hydration flow in app/studio/page.tsx.
        if (primaryClip) {
          void cacheClipForOfflineEditing({
            clipId,
            title: projectTitle,
            tracks: [primaryClip],
            status: "saved",
            assignedPlaylistId: selectedPlaylistId,
            zoomRegions: state.zoomRegions,
            blurRegions: state.blurRegions,
            textRegions: state.textRegions,
            cuts: state.cuts,
            filters: state.filters,
          });
        }

        // The backend now has this project — the pre-save local draft
        // (useStudioPersistence's crash/reload safety net, keyed by a
        // browser-local id rather than this real clip id) is superseded by
        // the mirror written above and would otherwise sit in IndexedDB
        // forever, never looked up again under its old key.
        void indexedDbStorage.deleteProjectDraft(getOrCreateLocalProjectId());
        clearLocalProjectId();

        // "updated" only reflects a genuine in-place overwrite (`targetClipId`
        // truthy) — a fork created a brand new clip, so that toast wording
        // ("Clip updated") would be misleading even though `existingClipId`
        // is still set for the session it was forked from.
        router.push(targetClipId ? "/library/clips?updated=1" : "/library/clips");
      } catch (error) {
        setPlaylistError(error instanceof ApiError ? error.message : "Couldn't save this clip — please try again.");
      } finally {
        setIsSaving(false);
      }
    },
    [
      isSaving,
      selectedPlaylistId,
      projectTitle,
      description,
      isPublished,
      existingClipId,
      videoClips,
      state.zoomRegions,
      state.blurRegions,
      state.textRegions,
      state.cuts,
      state.filters,
      addClipToPlaylist,
      router,
    ],
  );

  return {
    projectTitle,
    isEditingTitle,
    startEditingTitle,
    commitTitle,
    processingStatus,
    isPublished,
    setIsPublished,
    isSaving,
    playlists,
    isExistingProject: Boolean(existingClipId),
    originalPlaylistId: originalPlaylistId ?? null,
    selectedPlaylistId,
    selectPlaylist,
    createPlaylist: createQuickPlaylist,
    playlistError,
    description,
    setDescription,
    steps,
    addStep,
    updateStep,
    removeStep,
    handleSaveAndFinish,
  };
};
