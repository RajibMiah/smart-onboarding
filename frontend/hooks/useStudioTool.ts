"use client";

import { useCallback, useState } from "react";

import type { StudioTool } from "@/types/studio";

interface DrawerState {
  activeTool: StudioTool;
  isDrawerOpen: boolean;
}

interface UseStudioToolResult {
  activeTool: StudioTool;
  isDrawerOpen: boolean;
  /** Whether the rail's "overlay" tool group (Blur/Text/Elements/Zoom/Settings) is shown. */
  isRailExpanded: boolean;
  /** Rail click semantics: selecting the already-active tool toggles the drawer. */
  selectTool: (tool: StudioTool) => void;
  /** Unconditionally switches to `tool` and opens the drawer — for triggers
   *  elsewhere in the UI (e.g. "Add from Library") that mean "show me this
   *  panel", not "toggle it". */
  openTool: (tool: StudioTool) => void;
  closeDrawer: () => void;
  toggleRailExpanded: () => void;
}

/**
 * Plain hook, not a context — `StudioToolRail` and `StudioDrawer` are both
 * direct children of `EditorLayoutInner`, which calls this once and passes
 * the result to each as props. A dedicated context would just be one more
 * provider for no benefit when the state only needs to cross one level.
 *
 * `activeTool` and `isDrawerOpen` are one state object, updated atomically —
 * an earlier version toggled `isDrawerOpen` from inside `setActiveTool`'s
 * updater, which is an impure updater (a nested setState as a side effect).
 * React Strict Mode double-invokes updaters in dev to catch exactly this,
 * so that nested toggle fired twice and silently canceled itself out.
 */
export const useStudioTool = (initialTool: StudioTool = "media"): UseStudioToolResult => {
  const [drawerState, setDrawerState] = useState<DrawerState>({ activeTool: initialTool, isDrawerOpen: true });
  const [isRailExpanded, setIsRailExpanded] = useState(true);

  const selectTool = useCallback((tool: StudioTool) => {
    setDrawerState((prev) =>
      prev.activeTool === tool
        ? { activeTool: prev.activeTool, isDrawerOpen: !prev.isDrawerOpen }
        : { activeTool: tool, isDrawerOpen: true },
    );
  }, []);

  const openTool = useCallback((tool: StudioTool) => {
    setDrawerState({ activeTool: tool, isDrawerOpen: true });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerState((prev) => ({ ...prev, isDrawerOpen: false }));
  }, []);

  const toggleRailExpanded = useCallback(() => setIsRailExpanded((prev) => !prev), []);

  return {
    activeTool: drawerState.activeTool,
    isDrawerOpen: drawerState.isDrawerOpen,
    isRailExpanded,
    selectTool,
    openTool,
    closeDrawer,
    toggleRailExpanded,
  };
};
