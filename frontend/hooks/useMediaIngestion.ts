"use client";

import { useCallback } from "react";

import { useEditor } from "@/context/EditorContext";
import { useFFmpegWasm } from "@/hooks/useFFmpegWasm";
import { createMediaAsset, createTimelineClipFromAsset } from "@/lib/editor/create-clip";
import { inferExtension } from "@/lib/editor/media-utils";
import type { ClipKind } from "@/lib/editor/types";
import { computeWaveformPeaks } from "@/lib/editor/waveform";

interface IngestInput {
  src: string;
  name: string;
  duration: number;
  type: ClipKind;
}

interface UseMediaIngestionResult {
  /** Adds a new recording/upload to the bin and the timeline, then generates
   *  its thumbnail strip / waveform in the background. */
  ingest: (input: IngestInput) => void;
}

/**
 * The glue between capture (`useMediaRecorder`, file `<input>`) and the
 * editor's data model: wraps raw media as a bin asset + timeline clip
 * immediately (so it's editable right away), then fills in thumbnails and a
 * waveform asynchronously once ffmpeg.wasm has processed it — the editor
 * never blocks on the wasm engine loading.
 */
export const useMediaIngestion = (): UseMediaIngestionResult => {
  const { state, addMediaAsset, addClip, setThumbnails, setAssetThumbnails, setWaveform, setAssetWaveform } = useEditor();
  const { generateThumbnails, extractAudio } = useFFmpegWasm();

  const ingest = useCallback(
    (input: IngestInput) => {
      const asset = createMediaAsset(input);
      addMediaAsset(asset);

      const clip = createTimelineClipFromAsset(asset, state.tracks);
      addClip(clip);

      const extension = inferExtension(input.name);

      if (input.type === "video") {
        generateThumbnails(input.src, input.duration, { count: 10 })
          .then((thumbnails) => {
            setThumbnails(clip.id, thumbnails);
            setAssetThumbnails(asset.id, thumbnails);
          })
          .catch(() => undefined);
      }

      // Both video (for its audio track) and audio clips get a waveform.
      extractAudio(input.src, extension)
        .then(async ({ blob }) => {
          const peaks = await computeWaveformPeaks(blob);
          setWaveform(clip.id, peaks);
          setAssetWaveform(asset.id, peaks);
        })
        .catch(() => undefined);
    },
    [state.tracks, addMediaAsset, addClip, generateThumbnails, extractAudio, setThumbnails, setAssetThumbnails, setWaveform, setAssetWaveform],
  );

  return { ingest };
};
