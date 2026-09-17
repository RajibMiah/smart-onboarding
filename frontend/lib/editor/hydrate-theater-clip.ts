import type { ApiTheaterClip } from "@/lib/api-client";
import type { BlurRegion, TextRegion } from "@/types/overlays";
import { DEFAULT_FILTER_SETTINGS, type ProjectMetadataPayload, type TimelineCut, type VideoFilterSettings } from "@/types/project";
import type { ZoomRegion } from "@/types/zoom";

/**
 * Flattens a Theater clip's nested timeline tracks into the same
 * `ProjectMetadataPayload` shape `VideoReviewPlayer` already knows how to
 * play — the same region-mapping rules `app/studio/page.tsx` uses to
 * hydrate a resumed editing session, applied here to build a read-only
 * playback payload instead.
 */
export const hydrateTheaterClip = (clip: ApiTheaterClip, assignedPlaylistId: string | null): ProjectMetadataPayload => {
  const videoAsset = clip.assets.find((asset) => asset.asset_type === "video");
  const duration = Number(clip.duration_seconds) || 0;

  const zoomRegions: ZoomRegion[] = [];
  const blurRegions: BlurRegion[] = [];
  const textOverlays: TextRegion[] = [];
  const cuts: TimelineCut[] = [];

  for (const track of clip.tracks) {
    for (const region of track.zoom_regions) {
      zoomRegions.push({
        id: region.id,
        name: `Zoom ${zoomRegions.length + 1}`,
        startTime: Number(region.start_time),
        endTime: Number(region.end_time),
        scale: Number(region.scale_factor),
        bounds: {
          x: Number(region.position_x) / 100,
          y: Number(region.position_y) / 100,
          width: Number(region.width_pct) / 100,
          height: Number(region.height_pct) / 100,
        },
      });
    }
    for (const region of track.blur_regions) {
      blurRegions.push({
        id: region.id,
        name: `Blur ${blurRegions.length + 1}`,
        startTime: Number(region.start_time),
        endTime: Number(region.end_time),
        shape: region.shape,
        blurRadius: region.blur_radius,
        feather: false,
        bounds: {
          x: Number(region.position_x) / 100,
          y: Number(region.position_y) / 100,
          width: Number(region.width_pct) / 100,
          height: Number(region.height_pct) / 100,
        },
      });
    }
    for (const region of track.text_overlays) {
      textOverlays.push({
        id: region.id,
        content: region.content,
        startTime: Number(region.start_time),
        endTime: Number(region.end_time),
        // The backend only stores a position, not a saved box size — default to a reasonable footprint.
        bounds: { x: Number(region.position_x) / 100, y: Number(region.position_y) / 100, width: 0.3, height: 0.1 },
        style: {
          fontSize: region.font_size,
          fontWeight: "normal",
          textColor: region.color,
          backgroundColor: region.background_color,
          textAlign: "left",
        },
      });
    }
    for (const cut of track.cuts) {
      cuts.push({
        id: cut.id,
        startTime: Number(cut.start_time),
        endTime: Number(cut.end_time),
        type: cut.cut_type,
        speedMultiplier: cut.speed_multiplier ? Number(cut.speed_multiplier) : undefined,
      });
    }
  }

  const filters: VideoFilterSettings = { ...DEFAULT_FILTER_SETTINGS, ...clip.filter_settings };

  return {
    id: clip.id,
    title: clip.title,
    description: clip.description,
    status: clip.status === "processing" ? "processing" : clip.visibility === "published" ? "published" : "draft",
    duration,
    primaryMediaId: videoAsset?.id ?? "",
    primaryMediaUrl: videoAsset?.file_url ?? "",
    thumbnailUrl: clip.thumbnail_url,
    assignedPlaylistId,
    language: clip.language,
    filters,
    cuts,
    zoomRegions,
    blurRegions,
    textOverlays,
    createdAt: clip.created_at,
    updatedAt: clip.updated_at,
  };
};
