"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { EditorLayout } from "@/components/editor/EditorLayout";
import { Toast } from "@/components/ui/Toast";
import { useEditor } from "@/context/EditorContext";
import { useToast } from "@/hooks/useToast";
import { clipsApi, timelineTracksApi, type ApiCut } from "@/lib/api-client";
import { cacheClipForOfflineEditing } from "@/lib/editor/project-cache";
import type { TimelineClip } from "@/lib/editor/types";
import indexedDbStorage from "@/services/indexedDbStorage";
import { DEFAULT_FILTER_SETTINGS, type TimelineCut, type VideoFilterSettings } from "@/types/project";
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

const toTimelineCuts = (apiCuts: ApiCut[]): TimelineCut[] =>
  apiCuts.map((cut) => ({
    id: cut.id,
    startTime: Number(cut.start_time),
    endTime: Number(cut.end_time),
    type: cut.cut_type,
    speedMultiplier: cut.speed_multiplier ? Number(cut.speed_multiplier) : undefined,
  }));

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
      // Re-editing hydration, offline-first: a clip already opened once in
      // this browser has its metadata AND media cached locally, so reopening
      // it needs neither the network nor the backend to be reachable.
      try {
        const cachedDraft = await indexedDbStorage.getProjectDraft(clipId);
        if (cachedDraft && cachedDraft.timeline.tracks.length > 0) {
          const tracks: TimelineClip[] = [];
          for (const track of cachedDraft.timeline.tracks) {
            const blob = await indexedDbStorage.getMediaBlob(track.mediaId);
            if (!blob) break; // A missing blob means an incomplete cache — bail out to the network fallback below.
            const { mediaId, ...rest } = track;
            tracks.push({ ...rest, src: URL.createObjectURL(blob) });
          }
          if (tracks.length === cachedDraft.timeline.tracks.length) {
            if (cancelled) return;
            loadProject({
              clipId,
              tracks,
              zoomRegions: cachedDraft.timeline.zoomRegions,
              blurRegions: cachedDraft.timeline.blurRegions,
              textRegions: cachedDraft.timeline.textRegions,
              imageOverlays: [],
              // Drafts cached before cuts/filters existed in this store's
              // schema won't have these keys at all — default rather than
              // pass `undefined` through to reducer state.
              cuts: cachedDraft.timeline.cuts ?? [],
              filters: cachedDraft.timeline.filters ?? DEFAULT_FILTER_SETTINGS,
            });
            return;
          }
        }
      } catch {
        // Local cache miss/corruption is non-fatal — fall through to the network.
      }

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
        const cuts: TimelineCut[] = [];

        for (const track of tracksPage.results) {
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
          cuts.push(...toTimelineCuts(track.cuts));
        }

        const filters: VideoFilterSettings = { ...DEFAULT_FILTER_SETTINGS, ...clip.filter_settings };

        // Image overlays aren't part of the backend's per-clip resume payload yet
        // (no matching timeline-track type there) — only the local IndexedDB
        // draft flow round-trips them today.
        loadProject({ clipId, tracks, zoomRegions, blurRegions, textRegions, imageOverlays: [], cuts, filters });

        // Cache this clip locally (metadata + media blob) so the next time it's
        // opened, it hydrates from IndexedDB above without needing the network.
        if (videoAsset) {
          void cacheClipForOfflineEditing({
            clipId,
            title: clip.title,
            tracks,
            status: "ready",
            assignedPlaylistId: null,
            zoomRegions,
            blurRegions,
            textRegions,
            cuts,
            filters,
          });
        }
      } catch {
        if (!cancelled) toast.show("Couldn't load that clip for editing.");
      }
    })();

    return () => {
      cancelled = true;
      // React's Strict Mode runs this effect twice in dev (mount, cleanup,
      // mount): without re-arming the guard here, the first invocation's
      // fetch gets cancelled by this very cleanup before it resolves, while
      // the second (real) invocation sees `hasAttemptedLoad` already true
      // and never restarts the fetch — silently dropping the load entirely.
      hasAttemptedLoad.current = false;
    };
  }, [clipId, state.projectClipId, loadProject, toast]);

  return (
    <>
      <EditorLayout />
      {toast.message && <Toast message={toast.message} />}
    </>
  );
};
