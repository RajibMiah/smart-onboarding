/** Domain types for the Video Studio & Timeline Editor. */

export type ClipKind = "video" | "audio";

export type CanvasAspectRatio = "16:9" | "9:16" | "1:1";

export interface TimelineClip {
  id: string;
  type: ClipKind;
  /** Playable object URL for the underlying media blob. */
  src: string;
  /** Original file/recording name, used for display and to infer a container extension. */
  name: string;
  /** Full duration of the source media, in seconds — fixed once probed. */
  duration: number;
  /** Where this clip begins on the shared timeline, in seconds. */
  startOffset: number;
  /** In-point within the source media, in seconds. */
  trimStart: number;
  /** Out-point within the source media, in seconds. */
  trimEnd: number;
  /** Filmstrip thumbnail object URLs (video clips only); empty until generated. */
  thumbnails: string[];
  /** Normalized (0..1) amplitude peaks for waveform rendering; empty until generated. */
  waveformPeaks: number[];
  muted: boolean;
  /** 0..1 */
  volume: number;
}

/**
 * An ingested recording/upload before it's placed on the timeline — the
 * "Previous Medias" bin. Once added to a track it becomes a `TimelineClip`
 * (which additionally needs a timeline position and in/out points).
 */
export interface MediaAsset {
  id: string;
  type: ClipKind;
  src: string;
  name: string;
  duration: number;
  thumbnails: string[];
  waveformPeaks: number[];
}

/** Trimmed duration of a clip as it appears on the timeline. */
export function clipTimelineDuration(clip: TimelineClip): number {
  return Math.max(0, clip.trimEnd - clip.trimStart);
}

export function clipTimelineEnd(clip: TimelineClip): number {
  return clip.startOffset + clipTimelineDuration(clip);
}
