import type { ZoomRegion } from "@/types/zoom";

/** No zoom region active — the identity transform. */
export const IDENTITY_ZOOM_TRANSFORM = "scale(1) translate(0%, 0%)";

/**
 * CSS `transform` value for an active zoom region: scale() then translate(),
 * not `transform-origin`, since percentages in `translate()` resolve against
 * the element's own (unscaled) box — this re-centers the region's midpoint
 * on the viewport *before* the scale blows it up, landing on the same
 * result `transform-origin` would give, expressed the way the zoom-region
 * data is actually shaped (a bounding box, not a single origin point).
 *
 * Apply this to a wrapper containing BOTH the `<video>` and the blur/text
 * overlay layer — never to the `<video>` element alone. Blur/text overlays
 * are positioned as percentages of that wrapper's own box; if only the
 * video zooms, the overlays stay put while the footage underneath them
 * moves, so a blur mask drifts off whatever it was covering the moment a
 * zoom region activates. Grouping them under one transform keeps both in
 * sync. Native `<video controls>` has the opposite problem, which grouping
 * can't fix: the browser's own play/scrub/volume UI renders as part of the
 * video element's box, so it visually scales with the video regardless of
 * whether the transform sits on the video or a parent — the only fix is not
 * relying on native controls on a video that can be zoomed (see
 * VideoPlaybackControls, rendered as a sibling outside this transform entirely).
 */
export function computeZoomTransform(activeZoom: ZoomRegion | null): string {
  if (!activeZoom) return IDENTITY_ZOOM_TRANSFORM;
  const centerX = activeZoom.bounds.x + activeZoom.bounds.width / 2;
  const centerY = activeZoom.bounds.y + activeZoom.bounds.height / 2;
  return `scale(${activeZoom.scale}) translate(${(0.5 - centerX) * 100}%, ${(0.5 - centerY) * 100}%)`;
}
