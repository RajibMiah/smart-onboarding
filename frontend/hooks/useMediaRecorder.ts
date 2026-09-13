"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { probeMediaDuration } from "@/lib/editor/media-utils";

export type RecordingSource = "screen" | "camera";

export interface RecordingResult {
  blob: Blob;
  url: string;
  durationSeconds: number;
  name: string;
}

interface UseMediaRecorderOptions {
  onComplete: (result: RecordingResult) => void;
}

interface UseMediaRecorderResult {
  isRecording: boolean;
  recordingSource: RecordingSource | null;
  elapsedSeconds: number;
  error: string | null;
  startScreenRecording: () => Promise<void>;
  startCameraRecording: () => Promise<void>;
  stopRecording: () => void;
}

/** First mime type the browser's `MediaRecorder` actually supports. */
const pickSupportedMimeType = (): string => {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
};

/**
 * Screen and webcam recording via `getDisplayMedia` / `getUserMedia` +
 * `MediaRecorder`, buffered entirely in memory and handed back as a
 * ready-to-play `Blob`/object URL — no upload, no server involved.
 */
export const useMediaRecorder = ({ onComplete }: UseMediaRecorderOptions): UseMediaRecorderResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSource, setRecordingSource] = useState<RecordingSource | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const teardownStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Stop cleanly if the component unmounts mid-recording.
  useEffect(() => () => {
    stopTimer();
    teardownStream();
  }, [stopTimer, teardownStream]);

  const beginRecording = useCallback(
    (stream: MediaStream, source: RecordingSource) => {
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const durationSeconds = await probeMediaDuration(url).catch(() => (Date.now() - startedAtRef.current) / 1000);
        const label = source === "screen" ? "Screen Recording" : "Camera Recording";
        onComplete({ blob, url, durationSeconds, name: `${label} ${new Date().toLocaleString()}.webm` });
        teardownStream();
        setIsRecording(false);
        setRecordingSource(null);
      };

      // If the user stops sharing from the browser's own "Stop sharing" UI.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      });

      recorderRef.current = recorder;
      streamRef.current = stream;
      startedAtRef.current = Date.now();
      recorder.start();

      setIsRecording(true);
      setRecordingSource(source);
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((Date.now() - startedAtRef.current) / 1000);
      }, 200);
    },
    [onComplete, stopTimer, teardownStream],
  );

  const startScreenRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      beginRecording(stream, "screen");
    } catch {
      setError("Screen recording was cancelled or permission was denied.");
    }
  }, [beginRecording]);

  const startCameraRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      beginRecording(stream, "camera");
    } catch {
      setError("Camera access was cancelled or permission was denied.");
    }
  }, [beginRecording]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  return {
    isRecording,
    recordingSource,
    elapsedSeconds,
    error,
    startScreenRecording,
    startCameraRecording,
    stopRecording,
  };
};
