/** Normalized (0..1) rectangle relative to the video's own frame — independent of canvas display size. */
export interface ZoomRegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoomRegion {
  id: string;
  name: string;
  /** Timeline position, in seconds — matches `TimelineClip.startOffset`'s coordinate space. */
  startTime: number;
  endTime: number;
  /** e.g. 1.5 for 1.5x */
  scale: number;
  bounds: ZoomRegionBounds;
}

export const zoomRegionDuration = (region: ZoomRegion): number => {
  return Math.max(0, region.endTime - region.startTime);
};
