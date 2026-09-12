"use client";

import { useCallback, useEffect, useState } from "react";

interface UseToastResult {
  message: string | null;
  show: (message: string) => void;
  dismiss: () => void;
}

/** Minimal ephemeral toast for stubbed actions (no backend yet) — auto-dismisses. */
export function useToast(autoDismissMs = 2600): UseToastResult {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), autoDismissMs);
    return () => clearTimeout(timer);
  }, [message, autoDismissMs]);

  const show = useCallback((next: string) => setMessage(next), []);
  const dismiss = useCallback(() => setMessage(null), []);

  return { message, show, dismiss };
}
