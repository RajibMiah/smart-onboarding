import type { ReactNode } from "react";

import { EditorProvider } from "@/context/EditorContext";

/**
 * Shared across `/studio` and `/studio/review` so the same editing session
 * (clips, tracks, zoom/blur/text regions) survives navigating from the
 * timeline editor to the review step and back — the provider only mounts
 * once here, not per-page.
 */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return <EditorProvider>{children}</EditorProvider>;
}
