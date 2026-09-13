/**
 * Canonical, backend-agnostic shape for a Studio project's non-destructive
 * edits — the common vocabulary shared by `EditorContext` (in-memory),
 * `services/indexedDbStorage.ts` (local cache), and the DRF API (source of
 * truth). `ZoomRegion`/`BlurRegion`/`TextRegion` are reused as-is from their
 * existing homes; only `TimelineCut` and `VideoFilterSettings` are new.
 */

import type { BlurRegion, TextRegion } from "@/types/overlays";
import type { ZoomRegion } from "@/types/zoom";

export type CutType = "keep" | "silence_speedup" | "cut";

export interface TimelineCut {
  id: string;
  startTime: number;
  endTime: number;
  type: CutType;
  /** Required for `silence_speedup`; ignored otherwise (backend rejects it without one). */
  speedMultiplier?: number;
}

/** brightness/contrast/saturation: 100 = unchanged, matching CSS `filter()` percentage units. */
export interface VideoFilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  volumeGain: number;
  noiseSuppression: boolean;
}

export const DEFAULT_FILTER_SETTINGS: VideoFilterSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  volumeGain: 1,
  noiseSuppression: false,
};

/** Builds the CSS `filter` value driving the live Studio/Review preview. */
export const cssFilterString = (filters: VideoFilterSettings): string => {
  return `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`;
};

/**
 * The full round-trippable project shape. Not every field is threaded
 * through every layer verbatim (the backend keeps `status`/`visibility` as
 * two separate concepts — see `mapClipToProjectStatus` in lib/editor — but
 * this is the shape IndexedDB's `project_drafts` store persists and what a
 * save assembles before dispatching to the backend).
 */
export interface ProjectMetadataPayload {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "processing";
  duration: number;
  primaryMediaId: string;
  primaryMediaUrl: string;
  thumbnailUrl: string;
  assignedPlaylistId: string | null;
  language: string;
  filters: VideoFilterSettings;
  cuts: TimelineCut[];
  zoomRegions: ZoomRegion[];
  blurRegions: BlurRegion[];
  textOverlays: TextRegion[];
  createdAt: string;
  updatedAt: string;
}
