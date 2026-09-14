"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEditor } from "@/context/EditorContext";
import {
  ApiError,
  autoEditApi,
  clipsApi,
  timelineTracksApi,
  type ApiAutoEditResult,
  type ApiTranscriptSegment,
} from "@/lib/api-client";
import type { AutoEditConfig } from "./useAutoEditWorkflow";

const POLL_INTERVAL_MS = 1500;

export type AutoEditPhase =
  | "idle"
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
 * Requires an already-saved backend clip (`state.projectClipId`): a fresh,
 * never-saved recording has no id yet for the backend job to attach
 * results to (see the `useStudioPersistence` loss-proofing pass — a
 * deliberately separate decision from also auto-creating a backend Clip at
 * record time).
 */
export function useAutoEditJob(): UseAutoEditJobResult {
  const { state, addClip, updateClip, addCut } = useEditor();
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

  const start = useCallback(
    async (config: AutoEditConfig) => {
      const clipId = state.projectClipId;
      if (!clipId) {
        setPhase("failed");
        setError("Save this project first (Studio → Next → Done) — Auto-edit attaches its results to a saved clip.");
        return;
      }

      cancelledRef.current = false;
      setError(null);
      setTranscriptSegments([]);
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
    [state.projectClipId, hydrateResult],
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
