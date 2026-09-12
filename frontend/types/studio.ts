import type { ComponentType } from "react";

/** Every tool on the Studio's vertical rail. */
export type StudioTool =
  | "auto-edit"
  | "media"
  | "audio"
  | "blur"
  | "text"
  | "elements"
  | "zoom"
  | "settings";

/** The rail's two visual groups, separated by a divider. */
export type StudioToolGroup = "media" | "overlay";

export interface StudioToolMeta {
  id: StudioTool;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: StudioToolGroup;
}

/** Shape returned by `useStudioTool` — which tool is active and whether its drawer is open. */
export interface DrawerVisibilityState {
  activeTool: StudioTool;
  isOpen: boolean;
}
