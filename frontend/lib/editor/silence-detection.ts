import type { TimelineCut } from "@/types/project";

/** Analysis window size — short enough to localize silence boundaries within ~1 frame at 24fps. */
const WINDOW_SECONDS = 0.05;
/** RMS amplitude below this (linear 0..1, ~ -40dBFS) counts as silence. */
const SILENCE_AMPLITUDE_THRESHOLD = 0.01;
/** Shorter silences than this aren't worth a speed ramp — they read as natural pauses, not dead air. */
const MIN_SILENCE_SECONDS = 0.4;
/** Keep a little breathing room around speech so a speedup doesn't clip the tail/head of a word. */
const PADDING_SECONDS = 0.08;
/** A silence compresses to at most this many seconds of playback, however long it actually ran. */
const TARGET_COMPRESSED_SECONDS = 0.4;
const MIN_SPEED_MULTIPLIER = 2;
const MAX_SPEED_MULTIPLIER = 8;

export interface DetectSilenceOptions {
  /** Seconds to add to every detected range so it lands in shared-timeline coordinates, not clip-local. */
  timelineOffset?: number;
}

/**
 * Decodes an extracted audio track and scans it for stretches of near-silence,
 * emitting a `silence_speedup` cut for each one long enough to matter. Pure
 * RMS-energy thresholding over short windows — no ML model, but a real,
 * standard technique (the same basic approach tools like Descript's
 * "Remove filler words/silence" use under the hood).
 */
export async function detectSilence(audioBlob: Blob, options: DetectSilenceOptions = {}): Promise<TimelineCut[]> {
  const offset = options.timelineOffset ?? 0;
  const arrayBuffer = await audioBlob.arrayBuffer();

  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = Math.max(1, Math.round(WINDOW_SECONDS * sampleRate));

    // Mix all channels down to mono so a silence in one channel but not
    // another (rare, but possible with stereo mic setups) isn't flagged.
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, i) => audioBuffer.getChannelData(i));
    const totalSamples = audioBuffer.length;

    const silentWindows: boolean[] = [];
    for (let start = 0; start < totalSamples; start += windowSize) {
      const end = Math.min(start + windowSize, totalSamples);
      let sumSquares = 0;
      let count = 0;
      for (const channel of channels) {
        for (let i = start; i < end; i++) {
          sumSquares += channel[i] * channel[i];
          count++;
        }
      }
      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      silentWindows.push(rms < SILENCE_AMPLITUDE_THRESHOLD);
    }

    // Merge consecutive silent windows into ranges, in seconds.
    const ranges: { start: number; end: number }[] = [];
    let rangeStart: number | null = null;
    silentWindows.forEach((isSilent, index) => {
      const time = (index * windowSize) / sampleRate;
      if (isSilent && rangeStart === null) {
        rangeStart = time;
      } else if (!isSilent && rangeStart !== null) {
        ranges.push({ start: rangeStart, end: time });
        rangeStart = null;
      }
    });
    if (rangeStart !== null) ranges.push({ start: rangeStart, end: audioBuffer.duration });

    return ranges
      .map((range) => ({ start: range.start + PADDING_SECONDS, end: range.end - PADDING_SECONDS }))
      .filter((range) => range.end - range.start >= MIN_SILENCE_SECONDS)
      .map((range) => {
        const duration = range.end - range.start;
        const speedMultiplier = Math.min(
          MAX_SPEED_MULTIPLIER,
          Math.max(MIN_SPEED_MULTIPLIER, Math.round((duration / TARGET_COMPRESSED_SECONDS) * 10) / 10),
        );
        return {
          id: crypto.randomUUID(),
          startTime: range.start + offset,
          endTime: range.end + offset,
          type: "silence_speedup" as const,
          speedMultiplier,
        };
      });
  } finally {
    await audioContext.close();
  }
}
