import type { ClipKind, MediaAsset, TimelineClip } from "./types";
import { clipTimelineEnd } from "./types";

/** Wraps a fresh recording/upload as a bin asset, ready to drop on the timeline. */
export const createMediaAsset = (input: { src: string; name: string; duration: number; type: ClipKind }): MediaAsset => {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    src: input.src,
    name: input.name,
    duration: input.duration,
    thumbnails: [],
    waveformPeaks: [],
  };
};

/** Places a bin asset onto the timeline, appended after the last clip of the same type. */
export const createTimelineClipFromAsset = (asset: MediaAsset, existingTracks: TimelineClip[]): TimelineClip => {
  const sameKind = existingTracks.filter((clip) => clip.type === asset.type);
  const startOffset = sameKind.reduce((max, clip) => Math.max(max, clipTimelineEnd(clip)), 0);

  return {
    id: crypto.randomUUID(),
    type: asset.type,
    src: asset.src,
    name: asset.name,
    duration: asset.duration,
    startOffset,
    trimStart: 0,
    trimEnd: asset.duration,
    thumbnails: [...asset.thumbnails],
    waveformPeaks: [...asset.waveformPeaks],
    muted: false,
    volume: 1,
  };
};
