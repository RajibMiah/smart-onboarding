"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEditor } from "@/context/EditorContext";
import {
  ApiError,
  autoEditApi,
  clipsApi,
  mediaAssetsApi,
  timelineTracksApi,
  type ApiAutoEditResult,
  type ApiTranscriptSegment,
} from "@/lib/api-client";
import { defaultProjectTitle, slugify } from "@/lib/editor/project-defaults";
import type { TimelineClip } from "@/lib/editor/types";
import type { AutoEditConfig } from "./useAutoEditWorkflow";

const POLL_INTERVAL_MS = 1500;

export type AutoEditPhase =
  | "idle"
  | "preparing"
  | "queued"
  | "transcribing"
  | "generating_script"
  | "synthesizing_voice"
  | "ready"
  | "failed";

const STATE_TO_PHASE: Record<string, AutoEditPhase> = {
  PENDING: "queued",
  TRANSCRIBING: "transcribing",
  GENERATING_SCRIPT: "generating_script",
  SYNTHESIZING_VOICE: "synthesizing_voice",
  READY: "ready",
  SUCCESS: "ready",
  FAILURE: "failed",
};

export interface TranscriptSegmentPreview {
  id: string;
  startTime: number;
  endTime: number;
  scriptText: string;
}

interface UseAutoEditJobResult {
  phase: AutoEditPhase;
  /** Ready-to-display label for the progress banner — "Transcribing...", "Ready", etc. */
  phaseLabel: string;
  isProcessing: boolean;
  error: string | null;
  /** The Ollama-refined script, once a voiceover run completes — read-only preview data;
   *  there's no dedicated interactive transcript panel yet, see AutoEditPanel.tsx. */
  transcriptSegments: TranscriptSegmentPreview[];
  start: (config: AutoEditConfig) => Promise<void>;
}

/**
 * Drives the AI Auto-Edit & Voiceover pipeline from the Studio drawer:
 * POSTs the job, polls its status, and — once it succeeds — pulls the
 * results (silence cuts, the synthesized voiceover track, its script) into
 * the live `EditorContext` timeline the same way any other edit lands
 * there, so Undo/Redo and Review's save cover it for free.
 *
 * The backend job is clip-scoped (`POST /clips/<id>/auto-edit/`), so a
 * fresh, never-saved recording (`state.projectClipId` still null) needs a
 * real backend `Clip` before it can run at all — `ensureClipDraftSaved`
 * silently creates a minimal draft one and uploads the current primary
 * video the first time `start` is called without one, rather than blocking
 * the user with a "save first" error. `state.projectClipId` is stamped via
 * `setProjectClipId` (not `loadProject`), so the rest of the in-progress
 * session — tracks, regions, undo history — is left completely alone;
 * Review's "Done" then sees this id already set and updates the same draft
 * in place instead of creating a second clip.
 *
 * Trade-off worth knowing: if the user never reaches Review, this draft
 * Clip is left behind (visible only to them, under "My Library", as a
 * `draft`-visibility clip) rather than cleaned up automatically.
 */
export function useAutoEditJob(): UseAutoEditJobResult {
  const { state, addClip, updateClip, addCut, setProjectClipId } = useEditor();
  const [phase, setPhase] = useState<AutoEditPhase>("idle");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegmentPreview[]>([]);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    },
    [],
  );

  const hydrateResult = useCallback(
    async (clipId: string, result: ApiAutoEditResult) => {
      const needsTracks = Boolean(result.cut_track_id || result.audio_track_id);
      const [tracksPage, clip] = await Promise.all([
        needsTracks ? timelineTracksApi.listByClip(clipId) : Promise.resolve(null),
        result.audio_asset_id ? clipsApi.get(clipId) : Promise.resolve(null),
      ]);

      if (result.cut_track_id && tracksPage) {
        const cutTrack = tracksPage.results.find((track) => track.id === result.cut_track_id);
        for (const cut of cutTrack?.cuts ?? []) {
          addCut({
            startTime: Number(cut.start_time),
            endTime: Number(cut.end_time),
            type: cut.cut_type,
            speedMultiplier: cut.speed_multiplier ? Number(cut.speed_multiplier) : undefined,
          });
        }
      }

      let refinedSegments: ApiTranscriptSegment[] = [];
      if (result.audio_track_id && tracksPage) {
        const audioTrack = tracksPage.results.find((track) => track.id === result.audio_track_id);
        refinedSegments = audioTrack?.transcript_segments ?? [];
      }

      if (result.audio_asset_id && clip) {
        const audioAsset = clip.assets.find((asset) => asset.id === result.audio_asset_id);
        if (audioAsset) {
          addClip({
            id: crypto.randomUUID(),
            type: "audio",
            src: audioAsset.file_url,
            name: "AI Voiceover",
            duration: audioAsset.duration,
            startOffset: 0,
            trimStart: 0,
            trimEnd: audioAsset.duration,
            thumbnails: [],
            waveformPeaks: [],
            muted: false,
            volume: 1,
          });
        }
        if (result.mute_original_audio) {
          const videoClip = state.tracks.find((track) => track.type === "video");
          if (videoClip) updateClip(videoClip.id, { muted: true });
        }
      }

      setTranscriptSegments(
        refinedSegments.map((segment) => ({
          id: segment.id,
          startTime: Number(segment.start_time),
          endTime: Number(segment.end_time),
          scriptText: segment.script_text,
        })),
      );
    },
    [addClip, addCut, updateClip, state.tracks],
  );

  /** Creates a minimal draft `Clip` + uploads `videoClip`'s current blob so
   *  a never-saved recording has a real backend id to run Auto-edit against.
   *  Registers under `setProjectClipId` — see this hook's docstring for why
   *  not `loadProject`. */
  const ensureClipDraftSaved = useCallback(
    async (videoClip: TimelineClip): Promise<string> => {
      const title = defaultProjectTitle();
      const clip = await clipsApi.create({
        title,
        slug: slugify(title),
        visibility: "draft",
        duration_seconds: Math.round(videoClip.duration),
      });

      const videoBlob = await fetch(videoClip.src).then((response) => response.blob());
      await mediaAssetsApi.upload({ clip: clip.id, asset_type: "video", file: videoBlob });

      setProjectClipId(clip.id);
      return clip.id;
    },
    [setProjectClipId],
  );

  const start = useCallback(
    async (config: AutoEditConfig) => {
      cancelledRef.current = false;
      setError(null);
      setTranscriptSegments([]);

      let clipId = state.projectClipId;
      if (!clipId) {
        const videoClip = state.tracks.find((track) => track.type === "video");
        if (!videoClip) {
          setPhase("failed");
          setError("No recording on the timeline yet — record or upload a clip before running Auto-edit.");
          return;
        }

        setPhase("preparing");
        setPhaseLabel("Preparing recording for AI analysis...");
        try {
          clipId = await ensureClipDraftSaved(videoClip);
        } catch (err) {
          setPhase("failed");
          setError(err instanceof ApiError ? err.message : "Couldn't prepare this recording for Auto-edit.");
          return;
        }
      }

      setPhase("queued");
      setPhaseLabel("Queued...");

      try {
        const { task_id: taskId } = await autoEditApi.start(clipId, {
          voiceover_mode: config.voiceoverMode,
          additional_context: config.additionalContext,
          use_dictionary: config.useDictionary,
          custom_dictionary: [],
          shorten_silences: config.shortenSilences,
          silence_strategy: config.silenceStrategy,
          silence_speed_multiplier: config.silenceSpeedMultiplier,
        });

        const poll = async () => {
          if (cancelledRef.current) return;
          const statusResponse = await autoEditApi.status(clipId, taskId);
          if (cancelledRef.current) return;

          setPhaseLabel(statusResponse.phase);
          setPhase(STATE_TO_PHASE[statusResponse.state] ?? "queued");

          if (statusResponse.state === "SUCCESS") {
            if (statusResponse.result) await hydrateResult(clipId, statusResponse.result);
            return;
          }
          if (statusResponse.state === "FAILURE") {
            setError(statusResponse.error ?? "Auto-edit failed.");
            return;
          }
          pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        };
        await poll();
      } catch (err) {
        setPhase("failed");
        setError(err instanceof ApiError ? err.message : "Couldn't start Auto-edit.");
      }
    },
    [state.projectClipId, state.tracks, ensureClipDraftSaved, hydrateResult],
  );

  return {
    phase,
    phaseLabel,
    isProcessing: phase !== "idle" && phase !== "ready" && phase !== "failed",
    error,
    transcriptSegments,
    start,
  };
}
