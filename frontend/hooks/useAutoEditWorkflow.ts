"use client";

import { useCallback, useState } from "react";

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

/**
 * Owns the Auto-edit workflow form state (voiceover mode, silence handling,
 * dictionary/context). Actually running the workflow is `useAutoEditJob`'s
 * job — kept separate since this one is pure form state with no backend
 * calls, reusable regardless of whether a job is in flight.
 */
export const useAutoEditWorkflow = (initialConfig: AutoEditConfig = DEFAULT_CONFIG) => {
  const [config, setConfig] = useState<AutoEditConfig>(initialConfig);

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

  return {
    config,
    setVoiceoverMode,
    setAdditionalContext,
    setUseDictionary,
    setShortenSilences,
    setSilenceStrategy,
    setSilenceSpeedMultiplier,
  };
};
