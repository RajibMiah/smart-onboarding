"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

const RESEND_COOLDOWN_SECONDS = 45;

const formatCountdown = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

/**
 * Owns OTP digit state, the resend cooldown timer, and DOM focus-shifting
 * (auto-advance, backspace-to-previous, arrow keys, paste-to-fill) via a refs
 * array the consuming input group registers into — `OtpInputGroup` is a thin
 * controlled view over this.
 */
export const useOtpVerification = (length: number = 6) => {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const [secondsRemaining, setSecondsRemaining] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => setSecondsRemaining((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const registerInputRef = useCallback(
    (index: number) => (el: HTMLInputElement | null) => {
      inputRefs.current[index] = el;
    },
    [],
  );

  const handleChange = useCallback(
    (index: number, rawValue: string) => {
      const char = rawValue.replace(/\D/g, "").slice(-1) ?? "";
      setDigits((prev) => {
        const next = [...prev];
        next[index] = char;
        return next;
      });
      if (char && index < length - 1) inputRefs.current[index + 1]?.focus();
    },
    [length],
  );

  const handleKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (event.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (event.key === "ArrowRight" && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, length],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      if (!pasted) return;
      event.preventDefault();
      const next = Array(length).fill("");
      pasted.split("").forEach((char, i) => {
        next[i] = char;
      });
      setDigits(next);
      inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
    },
    [length],
  );

  const resend = useCallback(() => setSecondsRemaining(RESEND_COOLDOWN_SECONDS), []);
  const reset = useCallback(() => {
    setDigits(Array(length).fill(""));
    setSecondsRemaining(RESEND_COOLDOWN_SECONDS);
    inputRefs.current[0]?.focus();
  }, [length]);

  const code = digits.join("");

  return {
    digits,
    code,
    isComplete: digits.every((digit) => digit !== ""),
    secondsRemaining,
    formattedCountdown: formatCountdown(secondsRemaining),
    canResend: secondsRemaining <= 0,
    registerInputRef,
    handleChange,
    handleKeyDown,
    handlePaste,
    resend,
    reset,
  };
};
