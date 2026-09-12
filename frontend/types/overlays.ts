/** Normalized (0..1) rectangle relative to the video's own frame — independent of canvas display size. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlurRegion {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  shape: "rectangle" | "ellipse";
  /** in px */
  blurRadius: number;
  /** Softens the mask edge instead of a hard cutoff. */
  feather: boolean;
  bounds: BoundingBox;
}

export interface TextRegion {
  id: string;
  content: string;
  startTime: number;
  endTime: number;
  bounds: BoundingBox;
  style: {
    fontSize: number;
    fontWeight: string;
    textColor: string;
    backgroundColor: string;
    textAlign: "left" | "center" | "right";
  };
}

export function blurRegionDuration(region: BlurRegion): number {
  return Math.max(0, region.endTime - region.startTime);
}

export function textRegionDuration(region: TextRegion): number {
  return Math.max(0, region.endTime - region.startTime);
}
