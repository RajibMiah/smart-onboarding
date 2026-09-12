/**
 * Decodes an audio blob into normalized (0..1) amplitude peaks for waveform
 * rendering. Pure Web Audio API — no ffmpeg involved at this step; ffmpeg's
 * job (see `useFFmpegWasm.extractAudio`) is only to strip the video track
 * first so decoding has less to chew through.
 */
export async function computeWaveformPeaks(audioBlob: Blob, bucketCount = 200): Promise<number[]> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerBucket = Math.max(1, Math.floor(channelData.length / bucketCount));

    const peaks: number[] = [];
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const start = bucket * samplesPerBucket;
      const end = Math.min(start + samplesPerBucket, channelData.length);
      let max = 0;
      for (let i = start; i < end; i += 1) {
        max = Math.max(max, Math.abs(channelData[i]));
      }
      peaks.push(max);
    }
    return peaks;
  } finally {
    await audioContext.close();
  }
}
