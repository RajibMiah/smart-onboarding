/** IndexedDB persistence types for the APC Studio editor — see services/indexedDbStorage.ts. */

import type { CanvasAspectRatio, TimelineClip } from "@/lib/editor/types";
import type { BlurRegion, ImageOverlay, TextRegion } from "@/types/overlays";
import type { ZoomRegion } from "@/types/zoom";

export const STUDIO_DB_NAME = "apc_studio_db";
export const STUDIO_DB_VERSION = 1;

export const STORE_MEDIA_BLOBS = "media_blobs";
export const STORE_PROJECT_DRAFTS = "project_drafts";
export const STORE_THUMBNAIL_CACHE = "thumbnail_cache";

export const DRAFT_UPDATED_AT_INDEX = "by_updated_at";
export const THUMBNAIL_CLIP_ID_INDEX = "by_clip_id";

/** Store 1: raw recorded/imported media, keyed by an id referenced from project drafts. */
export interface MediaBlobRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
  duration: number;
  createdAt: string;
}

export type DraftStatus = "draft" | "processing" | "ready" | "published";

/**
 * A `TimelineClip` as stored on disk. `mediaId` replaces the live, session-only
 * `src` object URL (which dies on reload) — it's resolved back into a fresh
 * object URL from `media_blobs` on restore.
 */
export type TimelineClipDraft = Omit<TimelineClip, "src"> & { mediaId: string };

/** An `ImageOverlay` as stored on disk — `mediaId` replaces `src` the same way `TimelineClipDraft` does. */
export type ImageOverlayDraft = Omit<ImageOverlay, "src"> & { mediaId: string };

export interface ProjectTimelineState {
  tracks: TimelineClipDraft[];
  canvasAspectRatio: CanvasAspectRatio;
  zoomRegions: ZoomRegion[];
  blurRegions: BlurRegion[];
  textRegions: TextRegion[];
  imageOverlays: ImageOverlayDraft[];
}

/** Store 2: one multi-track project draft, auto-saved as the editor changes. */
export interface ProjectDraft {
  id: string;
  title: string;
  status: DraftStatus;
  assignedPlaylistId: string | null;
  timeline: ProjectTimelineState;
  /** Every media_blobs id referenced anywhere in `timeline` — flat, for quick lookups/cleanup. */
  mediaIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Store 3: one extracted filmstrip frame for the timeline scrubber. */
export interface ThumbnailRecord {
  /** `${clipId}_${timestamp}` */
  id: string;
  clipId: string;
  timestamp: number;
  imageBlob: Blob;
}

export interface StorageQuotaEstimate {
  usage: number;
  quota: number;
  percentUsed: number;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
