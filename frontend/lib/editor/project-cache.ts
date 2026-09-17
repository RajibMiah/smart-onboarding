import indexedDbStorage from "@/services/indexedDbStorage";
import type { TimelineClip } from "@/lib/editor/types";
import type { TimelineCut, VideoFilterSettings } from "@/types/project";
import type { BlurRegion, TextRegion } from "@/types/overlays";
import type { DraftStatus, ProjectDraft, TimelineClipDraft } from "@/types/storage";
import type { ZoomRegion } from "@/types/zoom";

interface CacheClipInput {
  clipId: string;
  title: string;
  tracks: TimelineClip[];
  status: DraftStatus;
  assignedPlaylistId: string | null;
  zoomRegions: ZoomRegion[];
  blurRegions: BlurRegion[];
  textRegions: TextRegion[];
  cuts: TimelineCut[];
  filters: VideoFilterSettings;
}

/**
 * Mirrors a backend clip's full edit state into IndexedDB, keyed by the same
 * UUID as the backend `Clip` — the local half of "bidirectional" persistence.
 * Re-fetches and stores the actual media bytes (not just a URL), so the next
 * time this clip is opened it can hydrate fully offline. Best-effort: a
 * caching failure never surfaces to the user, since the backend save this
 * always follows already succeeded.
 */
export const cacheClipForOfflineEditing = async (input: CacheClipInput): Promise<void> => {
  try {
    const trackDrafts: TimelineClipDraft[] = [];
    for (const clip of input.tracks) {
      const blob = await fetch(clip.src).then((response) => response.blob());
      const mediaId = `media_${input.clipId}_${clip.id}`;
      await indexedDbStorage.saveMediaBlob(mediaId, blob, clip.duration);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit `src` from the rest
      const { src, ...rest } = clip;
      trackDrafts.push({ ...rest, mediaId });
    }

    const now = new Date().toISOString();
    const draft: ProjectDraft = {
      id: input.clipId,
      title: input.title,
      status: input.status,
      assignedPlaylistId: input.assignedPlaylistId,
      timeline: {
        tracks: trackDrafts,
        canvasAspectRatio: "16:9",
        zoomRegions: input.zoomRegions,
        blurRegions: input.blurRegions,
        textRegions: input.textRegions,
        imageOverlays: [],
        cuts: input.cuts,
        filters: input.filters,
      },
      mediaIds: trackDrafts.map((track) => track.mediaId),
      createdAt: now,
      updatedAt: now,
    };
    await indexedDbStorage.saveProjectDraft(draft);
  } catch {
    // Local caching is a pure optimization layered on top of an already-successful save/load.
  }
};

/**
 * Clears everything a deleted clip left in IndexedDB — its cached project
 * draft, every media blob that draft referenced, and any filmstrip
 * thumbnails — so a deletion doesn't leave orphaned local storage behind.
 * Best-effort and always runs after the backend delete already succeeded.
 */
export const purgeClipFromLocalCache = async (clipId: string): Promise<void> => {
  try {
    const draft = await indexedDbStorage.getProjectDraft(clipId);
    if (draft) {
      await Promise.all(draft.mediaIds.map((mediaId) => indexedDbStorage.deleteMediaBlob(mediaId)));
      await indexedDbStorage.deleteProjectDraft(clipId);
    }
    await indexedDbStorage.clearThumbnailsForClip(clipId);
  } catch {
    // Best-effort — the backend delete above already succeeded regardless.
  }
};
