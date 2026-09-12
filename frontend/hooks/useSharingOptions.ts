"use client";

import { useCallback, useState } from "react";

import type { SharingOptionsConfig } from "@/types/sharingOptions";

const DEFAULT_CONFIG: SharingOptionsConfig = {
  createSubtitles: false,
  generateSOP: false,
  generateStepByStepGuide: false,
  generateChapters: false,
  autoGenerateKeywords: false,
  translateVideo: false,
  contentBranding: "Default",
  publishAPC: false,
  navigateToReviewPage: true,
};

/**
 * Owns the Sharing Options form state — folded into the same Auto-edit
 * "Apply Workflow" submit as everything else on this panel, so unlike
 * `useAutoEditWorkflow` there's no separate apply/loading state here.
 */
export function useSharingOptions(initialConfig: SharingOptionsConfig = DEFAULT_CONFIG) {
  const [config, setConfig] = useState<SharingOptionsConfig>(initialConfig);

  const setField = useCallback(<K extends keyof SharingOptionsConfig>(key: K, value: SharingOptionsConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { config, setField };
}
