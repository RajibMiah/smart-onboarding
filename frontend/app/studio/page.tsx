"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { EditorLayout } from "@/components/editor/EditorLayout";
import { Toast } from "@/components/ui/Toast";
import { useEditor } from "@/context/EditorContext";
import { useToast } from "@/hooks/useToast";
import { clipsApi, timelineTracksApi } from "@/lib/api-client";
import type { TimelineClip } from "@/lib/editor/types";
import type { BlurRegion, TextRegion } from "@/types/overlays";
import type { ZoomRegion } from "@/types/zoom";

const StudioPage = () => {
  return (
    <Suspense>
      <StudioPageContent />
    </Suspense>
  );
};
export default StudioPage;

const StudioPageContent = () => {
  const searchParams = useSearchParams();
  const clipId = searchParams.get("clip");
  const { state, loadProject } = useEditor();
  const toast = useToast();
  const hasAttemptedLoad = useRef(false);

  useEffect(() => {
    if (!clipId || hasAttemptedLoad.current || state.projectClipId === clipId) return;
    hasAttemptedLoad.current = true;

    let cancelled = false;

    (async () => {
      try {
        const [clip, tracksPage] = await Promise.all([clipsApi.get(clipId), timelineTracksApi.listByClip(clipId)]);
        if (cancelled) return;

        const videoAsset = clip.assets.find((asset) => asset.asset_type === "video");
        const duration = Number(clip.duration_seconds) || 0;

        const tracks: TimelineClip[] = videoAsset
          ? [
              {
                id: crypto.randomUUID(),
                type: "video",
                src: videoAsset.file_url,
                name: clip.title,
                duration,
                startOffset: 0,
                trimStart: 0,
                trimEnd: duration,
                thumbnails: [],
                waveformPeaks: [],
                muted: false,
                volume: 1,
              },
            ]
          : [];

        const zoomRegions: ZoomRegion[] = [];
        const blurRegions: BlurRegion[] = [];
        const textRegions: TextRegion[] = [];

        for (const track of tracksPage.results) {
          for (const region of track.zoom_regions) {
            zoomRegions.push({
              id: region.id,
              name: `Zoom ${zoomRegions.length + 1}`,
              startTime: Number(region.start_time),
              endTime: Number(region.end_time),
              scale: Number(region.scale_factor),
              bounds: {
                x: Number(region.x) / 100,
                y: Number(region.y) / 100,
                width: Number(region.width) / 100,
                height: Number(region.height) / 100,
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
                x: Number(region.x) / 100,
                y: Number(region.y) / 100,
                width: Number(region.width) / 100,
                height: Number(region.height) / 100,
              },
            });
          }
          for (const region of track.text_overlays) {
            textRegions.push({
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
        }

        loadProject({ clipId, tracks, zoomRegions, blurRegions, textRegions });
      } catch {
        if (!cancelled) toast.show("Couldn't load that clip for editing.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clipId, state.projectClipId, loadProject, toast]);

  return (
    <>
      <EditorLayout />
      {toast.message && <Toast message={toast.message} />}
    </>
  );
};
