"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useEditor } from "@/context/EditorContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import {
  blurRegionsApi,
  clipsApi,
  mediaAssetsApi,
  textOverlaysApi,
  timelineTracksApi,
  zoomRegionsApi,
  ApiError,
} from "@/lib/api-client";
import { captureVideoFrame } from "@/lib/editor/capture-frame";
import type { DocumentationStep, ProcessingStatus } from "@/types/review";

/** Simulated processing delay — there's no real transcoding backend yet. */
const PROCESSING_DURATION_MS = 3000;

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
  const { playlists, createPlaylist, addClipToPlaylist } = usePlaylists();
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
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<DocumentationStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
    async (durationSeconds: number) => {
      if (!selectedPlaylistId) {
        setPlaylistError("Select or create a playlist before finishing.");
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
        };

        let clipId: string;
        if (existingClipId) {
          // Re-editing a saved clip: replace its old assets/overlay tracks
          // rather than accumulating duplicates on every save.
          const existing = await clipsApi.get(existingClipId);
          await clipsApi.update(existingClipId, clipPayload);
          await Promise.all(existing.assets.map((asset) => mediaAssetsApi.remove(asset.id)));
          const existingTracks = await timelineTracksApi.listByClip(existingClipId);
          await Promise.all(existingTracks.results.map((track) => timelineTracksApi.remove(track.id)));
          clipId = existingClipId;
        } else {
          const created = await clipsApi.create(clipPayload);
          clipId = created.id;
        }

        const primaryClip = videoClips[0];
        if (primaryClip) {
          try {
            const videoBlob = await fetch(primaryClip.src).then((response) => response.blob());
            await mediaAssetsApi.upload({ clip: clipId, asset_type: "video", file: videoBlob });

            const thumbnailBlob = await captureVideoFrame(primaryClip.src);
            await clipsApi.uploadThumbnail(clipId, thumbnailBlob);
          } catch {
            // Media upload is best-effort — the clip record itself already saved successfully.
          }
        }

        const persistRegions = async (
          trackType: "zoom" | "blur" | "text",
          count: number,
          createRegion: (trackId: string) => Promise<unknown>,
        ) => {
          if (count === 0) return;
          const track = await timelineTracksApi.create({ clip: clipId, track_type: trackType });
          await createRegion(track.id);
        };

        await persistRegions("zoom", state.zoomRegions.length, (trackId) =>
          Promise.all(
            state.zoomRegions.map((region) =>
              zoomRegionsApi.create({
                track: trackId,
                x: String(region.bounds.x * 100),
                y: String(region.bounds.y * 100),
                width: String(region.bounds.width * 100),
                height: String(region.bounds.height * 100),
                scale_factor: String(region.scale),
                start_time: String(region.startTime),
                end_time: String(region.endTime),
              }),
            ),
          ),
        );

        await persistRegions("blur", state.blurRegions.length, (trackId) =>
          Promise.all(
            state.blurRegions.map((region) =>
              blurRegionsApi.create({
                track: trackId,
                x: String(region.bounds.x * 100),
                y: String(region.bounds.y * 100),
                width: String(region.bounds.width * 100),
                height: String(region.bounds.height * 100),
                shape: region.shape,
                blur_radius: region.blurRadius,
                start_time: String(region.startTime),
                end_time: String(region.endTime),
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
                position_x: String(region.bounds.x * 100),
                position_y: String(region.bounds.y * 100),
                font_size: region.style.fontSize,
                color: region.style.textColor,
                background_color: region.style.backgroundColor,
                start_time: String(region.startTime),
                end_time: String(region.endTime),
              }),
            ),
          ),
        );

        await addClipToPlaylist(selectedPlaylistId, clipId);
        router.push("/library/clips");
      } catch (error) {
        setPlaylistError(error instanceof ApiError ? error.message : "Couldn't save this clip — please try again.");
      } finally {
        setIsSaving(false);
      }
    },
    [
      selectedPlaylistId,
      projectTitle,
      description,
      isPublished,
      existingClipId,
      videoClips,
      state.zoomRegions,
      state.blurRegions,
      state.textRegions,
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
