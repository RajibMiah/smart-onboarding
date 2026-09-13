"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceoverMode = "auto_generate" | "ai_voice_clone" | "keep_original";
export type SilenceStrategy = "cut" | "speed_up";

export interface AutoEditConfig {
  voiceoverMode: VoiceoverMode;
  additionalContext: string;
  useDictionary: boolean;
  shortenSilences: boolean;
  silenceStrategy: SilenceStrategy;
  silenceSpeedMultiplier: number;
  voiceSettings: {
    language: string;
    voiceName: string;
    tone: string;
    speed: number;
  };
}

const DEFAULT_CONFIG: AutoEditConfig = {
  voiceoverMode: "auto_generate",
  additionalContext: "",
  useDictionary: true,
  shortenSilences: true,
  silenceStrategy: "speed_up",
  silenceSpeedMultiplier: 3,
  voiceSettings: {
    language: "English (US)",
    voiceName: "Carolin",
    tone: "Casual address",
    speed: 1,
  },
};

const APPLY_DURATION_MS = 1200;

/**
 * Owns the Auto-edit workflow form state. `applyWorkflow` is a timed stub —
 * there's no AI backend yet, so it just flips `isProcessing` for a beat and
 * reports back through `onNotify`, the same "not available in this offline
 * preview yet" convention the other Studio panels use.
 */
export const useAutoEditWorkflow = (initialConfig: AutoEditConfig = DEFAULT_CONFIG) => {
  const [config, setConfig] = useState<AutoEditConfig>(initialConfig);
  const [isProcessing, setIsProcessing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const setVoiceoverMode = useCallback((voiceoverMode: VoiceoverMode) => {
    setConfig((prev) => ({ ...prev, voiceoverMode }));
  }, []);

  const setAdditionalContext = useCallback((additionalContext: string) => {
    setConfig((prev) => ({ ...prev, additionalContext }));
  }, []);

  const setUseDictionary = useCallback((useDictionary: boolean) => {
    setConfig((prev) => ({ ...prev, useDictionary }));
  }, []);

  const setShortenSilences = useCallback((shortenSilences: boolean) => {
    setConfig((prev) => ({ ...prev, shortenSilences }));
  }, []);

  const setSilenceStrategy = useCallback((silenceStrategy: SilenceStrategy) => {
    setConfig((prev) => ({ ...prev, silenceStrategy }));
  }, []);

  const setSilenceSpeedMultiplier = useCallback((silenceSpeedMultiplier: number) => {
    setConfig((prev) => ({ ...prev, silenceSpeedMultiplier }));
  }, []);

  const applyWorkflow = useCallback((onNotify: (message: string) => void) => {
    setIsProcessing(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsProcessing(false);
      onNotify("Auto-edit workflow isn't available in this offline preview yet — your settings were saved.");
    }, APPLY_DURATION_MS);
  }, []);

  return {
    config,
    isProcessing,
    setVoiceoverMode,
    setAdditionalContext,
    setUseDictionary,
    setShortenSilences,
    setSilenceStrategy,
    setSilenceSpeedMultiplier,
    applyWorkflow,
  };
};
