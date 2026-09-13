import { Blend, Clapperboard, Music, Settings, Shapes, Sparkles, Type, ZoomIn } from "lucide-react";

import type { StudioTool, StudioToolMeta } from "@/types/studio";

/**
 * Rail metadata, in display order. "media" group sits above the divider,
 * "overlay" group below it and collapses under the rail's Less/More toggle.
 */
export const STUDIO_TOOLS: StudioToolMeta[] = [
  { id: "auto-edit", label: "Auto-edit", icon: Sparkles, group: "media" },
  { id: "media", label: "Media", icon: Clapperboard, group: "media" },
  { id: "audio", label: "Audio", icon: Music, group: "media" },
  { id: "blur", label: "Blur", icon: Blend, group: "overlay" },
  { id: "text", label: "Text", icon: Type, group: "overlay" },
  { id: "elements", label: "Elements", icon: Shapes, group: "overlay" },
  { id: "zoom", label: "Zoom", icon: ZoomIn, group: "overlay" },
  { id: "settings", label: "Settings", icon: Settings, group: "overlay" },
];

export const getStudioToolMeta = (tool: StudioTool): StudioToolMeta => {
  const meta = STUDIO_TOOLS.find((item) => item.id === tool);
  if (!meta) throw new Error(`Unknown studio tool: ${tool}`);
  return meta;
};
