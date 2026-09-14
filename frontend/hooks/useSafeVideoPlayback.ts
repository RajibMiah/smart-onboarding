"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

interface UseSafeVideoPlaybackOptions {
  /** The resolved, already-playable URL — a backend media URL for every
   *  caller today. Resolving an IndexedDB blob id into a live object URL
   *  (relevant to Studio's offline resume flow, not the Theater/Review
   *  players this hook backs) is the caller's job before this ever sees it;
   *  keeping that resolution out of the hook keeps it usable either way. */
  src: string;
  /** Attempt to resume playback once the *new* source becomes playable —
   *  skipped on this hook's very first source (nothing was playing yet to
   *  resume), so a freshly opened player never autoplays on its own. */
  autoPlayOnChange?: boolean;
  /** Fires in the cleanup of the source-change effect, given the *previous*
   *  source — the caller's hook to revoke a blob URL exactly once nothing
   *  still references it, never while the element could still be reading it. */
  onSourceReplaced?: (previousSrc: string) => void;
}

interface UseSafeVideoPlaybackResult {
  /** True once the current source has fired `canplay`/`loadeddata` for the first time. */
  isReady: boolean;
  /** True while the element has nothing to play right now (initial load or a mid-playback rebuffer). */
  isBuffering: boolean;
  /** True once the current source has fired a native `error` event — an
   *  unreachable URL, a 404, or a format the browser can't decode. Without
   *  listening for this, a broken source leaves `isBuffering` stuck `true`
   *  forever, since `canplay`/`loadeddata` simply never come. */
  hasError: boolean;
  /** The native `MediaError`'s own message, when the browser provides one —
   *  shown alongside the source URL so a real failure is self-diagnosable
   *  instead of a bare "couldn't load" with nothing to go on. */
  errorDetail: string | null;
  /** Safe to call any time — queues until the element can actually play if it
   *  isn't ready yet, and always catches an autoplay-policy rejection. */
  play: () => void;
  /** Re-runs the full load lifecycle against the *same* `src` — for a
   *  "Retry Stream" action, since a transient failure (a dropped connection
   *  mid-fetch, a momentary auth hiccup) doesn't necessarily mean the URL
   *  itself is bad, and the failed `src` never changing means the effect
   *  below won't re-run again on its own. */
  retry: () => void;
}

/**
 * Owns one `<video>` element's source-transition lifecycle so switching
 * clips (Theater's next/previous/select, or Review resuming a different
 * project) never leaves it stuck mid-seek or paused on the previous clip's
 * last frame:
 *
 * - `.pause()` before anything else, so a switch mid-playback doesn't race
 *   the old source's `timeupdate`/`ended` events against the new one.
 * - `.load()` forces the browser to fully re-run its resource-selection
 *   algorithm against the new `src` — changing just the `src` attribute and
 *   trusting the browser to notice is the well-known source of a video
 *   element getting stuck with stale `readyState`/buffered ranges.
 * - `currentTime` reset to 0 explicitly (defense in depth — `.load()` is
 *   already specified to do this, but this makes it true regardless).
 * - `.play()` never runs until `canplay`/`loadeddata` actually fires, and
 *   its promise is always caught — an unhandled rejection there is exactly
 *   what browsers throw for an autoplay attempt without a user gesture.
 */
export function useSafeVideoPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  { src, autoPlayOnChange = false, onSourceReplaced }: UseSafeVideoPlaybackOptions,
): UseSafeVideoPlaybackResult {
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const pendingPlayRef = useRef(false);
  const previousSrcRef = useRef(src);
  const isFirstSourceRef = useRef(true);
  const isRetryRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const previousSrc = previousSrcRef.current;
    previousSrcRef.current = src;

    setIsReady(false);
    setIsBuffering(true);
    setHasError(false);
    setErrorDetail(null);
    pendingPlayRef.current = isRetryRef.current || (autoPlayOnChange && !isFirstSourceRef.current);
    isRetryRef.current = false;
    isFirstSourceRef.current = false;

    const attemptPendingPlay = () => {
      setIsReady(true);
      setIsBuffering(false);
      if (!pendingPlayRef.current) return;
      pendingPlayRef.current = false;
      video.play().catch(() => {
        // Blocked by the browser's autoplay policy, or the clip changed
        // again before this resolved — native controls are still there.
      });
    };
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const MEDIA_ERROR_LABELS: Record<number, string> = {
      1: "Loading was aborted.",
      2: "A network error interrupted the download.",
      3: "The browser couldn't decode this file.",
      4: "This source isn't a supported video format, or couldn't be reached.",
    };
    const handleError = () => {
      // An unreachable/404/undecodable source never fires canplay or
      // loadeddata, so without this `isBuffering` would stay true forever —
      // the exact "stuck on Buffering…" symptom for a genuinely broken URL.
      pendingPlayRef.current = false;
      setIsBuffering(false);
      setHasError(true);
      const mediaError = video.error;
      setErrorDetail(mediaError?.message || (mediaError ? MEDIA_ERROR_LABELS[mediaError.code] : null) || null);
    };

    video.addEventListener("canplay", attemptPendingPlay);
    video.addEventListener("loadeddata", attemptPendingPlay);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("error", handleError);

    video.pause();
    video.load();
    video.currentTime = 0;

    return () => {
      video.removeEventListener("canplay", attemptPendingPlay);
      video.removeEventListener("loadeddata", attemptPendingPlay);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("error", handleError);
      onSourceReplaced?.(previousSrc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the source identity (or a retry) should restart this lifecycle
  }, [src, retryTick]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState >= video.HAVE_FUTURE_DATA) {
      video.play().catch(() => undefined);
    } else {
      pendingPlayRef.current = true;
    }
  }, [videoRef]);

  const retry = useCallback(() => {
    isRetryRef.current = true;
    setRetryTick((tick) => tick + 1);
  }, []);

  return { isReady, isBuffering, hasError, errorDetail, play, retry };
}
