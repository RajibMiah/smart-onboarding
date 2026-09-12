"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { createTimelineClipFromAsset } from "@/lib/editor/create-clip";
import { clipTimelineEnd, type CanvasAspectRatio, type MediaAsset, type TimelineClip } from "@/lib/editor/types";

const MAX_HISTORY = 50;

interface EditorState {
  tracks: TimelineClip[];
  /** Ingested recordings/uploads not (or no longer) placed on the timeline. */
  mediaBin: MediaAsset[];
  currentTime: number;
  isPlaying: boolean;
  /** Pixels per second — drives the timeline's horizontal scale. */
  zoomLevel: number;
  selectedClipId: string | null;
  snappingEnabled: boolean;
  canvasAspectRatio: CanvasAspectRatio;
  history: { past: TimelineClip[][]; future: TimelineClip[][] };
}

type Action =
  | { type: "ADD_CLIP"; clip: TimelineClip }
  | { type: "REMOVE_CLIP"; id: string }
  | { type: "UPDATE_CLIP"; id: string; changes: Partial<TimelineClip>; commit?: boolean }
  | { type: "SPLIT_CLIP"; id: string; atTime: number }
  | { type: "SET_THUMBNAILS"; id: string; thumbnails: string[] }
  | { type: "SET_WAVEFORM"; id: string; peaks: number[] }
  | { type: "ADD_MEDIA_ASSET"; asset: MediaAsset }
  | { type: "SET_ASSET_THUMBNAILS"; id: string; thumbnails: string[] }
  | { type: "SET_ASSET_WAVEFORM"; id: string; peaks: number[] }
  | { type: "ADD_ASSET_TO_TIMELINE"; assetId: string }
  | { type: "SELECT_CLIP"; id: string | null }
  | { type: "SET_CURRENT_TIME"; time: number }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "TOGGLE_SNAPPING" }
  | { type: "SET_CANVAS_ASPECT_RATIO"; aspectRatio: CanvasAspectRatio }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET_PROJECT" };

const INITIAL_STATE: EditorState = {
  tracks: [],
  mediaBin: [],
  currentTime: 0,
  isPlaying: false,
  zoomLevel: 60,
  selectedClipId: null,
  snappingEnabled: true,
  canvasAspectRatio: "16:9",
  history: { past: [], future: [] },
};

/** Deep-enough clone for history snapshots (clips are flat data + string[] arrays). */
function cloneTracks(tracks: TimelineClip[]): TimelineClip[] {
  return tracks.map((clip) => ({ ...clip, thumbnails: [...clip.thumbnails], waveformPeaks: [...clip.waveformPeaks] }));
}

function withHistorySnapshot(state: EditorState): EditorState["history"] {
  const past = [...state.history.past, cloneTracks(state.tracks)].slice(-MAX_HISTORY);
  return { past, future: [] };
}

function editorReducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "ADD_CLIP": {
      return {
        ...state,
        tracks: [...state.tracks, action.clip],
        selectedClipId: action.clip.id,
        history: withHistorySnapshot(state),
      };
    }

    case "REMOVE_CLIP": {
      return {
        ...state,
        tracks: state.tracks.filter((clip) => clip.id !== action.id),
        selectedClipId: state.selectedClipId === action.id ? null : state.selectedClipId,
        history: withHistorySnapshot(state),
      };
    }

    case "UPDATE_CLIP": {
      const history = action.commit ? withHistorySnapshot(state) : state.history;
      return {
        ...state,
        tracks: state.tracks.map((clip) => (clip.id === action.id ? { ...clip, ...action.changes } : clip)),
        history,
      };
    }

    case "SPLIT_CLIP": {
      const target = state.tracks.find((clip) => clip.id === action.id);
      if (!target) return state;
      const clipEnd = clipTimelineEnd(target);
      // Splitting only makes sense strictly inside the clip's on-timeline span.
      if (action.atTime <= target.startOffset || action.atTime >= clipEnd) return state;

      const sourceSplitPoint = target.trimStart + (action.atTime - target.startOffset);
      const left: TimelineClip = { ...target, trimEnd: sourceSplitPoint };
      const right: TimelineClip = {
        ...target,
        id: crypto.randomUUID(),
        trimStart: sourceSplitPoint,
        startOffset: action.atTime,
      };

      return {
        ...state,
        tracks: state.tracks.flatMap((clip) => (clip.id === action.id ? [left, right] : [clip])),
        selectedClipId: right.id,
        history: withHistorySnapshot(state),
      };
    }

    case "SET_THUMBNAILS":
      return {
        ...state,
        tracks: state.tracks.map((clip) => (clip.id === action.id ? { ...clip, thumbnails: action.thumbnails } : clip)),
      };

    case "SET_WAVEFORM":
      return {
        ...state,
        tracks: state.tracks.map((clip) => (clip.id === action.id ? { ...clip, waveformPeaks: action.peaks } : clip)),
      };

    case "ADD_MEDIA_ASSET":
      return { ...state, mediaBin: [action.asset, ...state.mediaBin] };

    case "SET_ASSET_THUMBNAILS":
      return {
        ...state,
        mediaBin: state.mediaBin.map((asset) => (asset.id === action.id ? { ...asset, thumbnails: action.thumbnails } : asset)),
      };

    case "SET_ASSET_WAVEFORM":
      return {
        ...state,
        mediaBin: state.mediaBin.map((asset) => (asset.id === action.id ? { ...asset, waveformPeaks: action.peaks } : asset)),
      };

    case "ADD_ASSET_TO_TIMELINE": {
      const asset = state.mediaBin.find((item) => item.id === action.assetId);
      if (!asset) return state;
      const clip = createTimelineClipFromAsset(asset, state.tracks);
      return {
        ...state,
        tracks: [...state.tracks, clip],
        selectedClipId: clip.id,
        history: withHistorySnapshot(state),
      };
    }

    case "SELECT_CLIP":
      return { ...state, selectedClipId: action.id };

    case "SET_CURRENT_TIME":
      return { ...state, currentTime: Math.max(0, action.time) };

    case "PLAY":
      return { ...state, isPlaying: true };

    case "PAUSE":
      return { ...state, isPlaying: false };

    case "TOGGLE_PLAY":
      return { ...state, isPlaying: !state.isPlaying };

    case "SET_ZOOM":
      return { ...state, zoomLevel: Math.min(240, Math.max(10, action.zoom)) };

    case "TOGGLE_SNAPPING":
      return { ...state, snappingEnabled: !state.snappingEnabled };

    case "SET_CANVAS_ASPECT_RATIO":
      return { ...state, canvasAspectRatio: action.aspectRatio };

    case "UNDO": {
      const previous = state.history.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        tracks: previous,
        history: {
          past: state.history.past.slice(0, -1),
          future: [cloneTracks(state.tracks), ...state.history.future],
        },
      };
    }

    case "REDO": {
      const next = state.history.future[0];
      if (!next) return state;
      return {
        ...state,
        tracks: next,
        history: {
          past: [...state.history.past, cloneTracks(state.tracks)],
          future: state.history.future.slice(1),
        },
      };
    }

    case "RESET_PROJECT":
      return INITIAL_STATE;

    default:
      return state;
  }
}

interface EditorContextValue {
  state: EditorState;
  videoClips: TimelineClip[];
  audioClips: TimelineClip[];
  selectedClip: TimelineClip | null;
  totalDuration: number;
  canUndo: boolean;
  canRedo: boolean;

  addClip: (clip: TimelineClip) => void;
  removeClip: (id: string) => void;
  updateClip: (id: string, changes: Partial<TimelineClip>, options?: { commit?: boolean }) => void;
  splitClipAtPlayhead: () => void;
  setThumbnails: (id: string, thumbnails: string[]) => void;
  setWaveform: (id: string, peaks: number[]) => void;
  addMediaAsset: (asset: MediaAsset) => void;
  setAssetThumbnails: (id: string, thumbnails: string[]) => void;
  setAssetWaveform: (id: string, peaks: number[]) => void;
  addAssetToTimeline: (assetId: string) => void;
  selectClip: (id: string | null) => void;
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setZoom: (zoom: number) => void;
  toggleSnapping: () => void;
  setCanvasAspectRatio: (aspectRatio: CanvasAspectRatio) => void;
  undo: () => void;
  redo: () => void;
  resetProject: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_STATE);

  const addClip = useCallback((clip: TimelineClip) => dispatch({ type: "ADD_CLIP", clip }), []);
  const removeClip = useCallback((id: string) => dispatch({ type: "REMOVE_CLIP", id }), []);
  const updateClip = useCallback(
    (id: string, changes: Partial<TimelineClip>, options?: { commit?: boolean }) =>
      dispatch({ type: "UPDATE_CLIP", id, changes, commit: options?.commit }),
    [],
  );
  const splitClipAtPlayhead = useCallback(() => {
    if (!state.selectedClipId) return;
    dispatch({ type: "SPLIT_CLIP", id: state.selectedClipId, atTime: state.currentTime });
  }, [state.selectedClipId, state.currentTime]);
  const setThumbnails = useCallback((id: string, thumbnails: string[]) => dispatch({ type: "SET_THUMBNAILS", id, thumbnails }), []);
  const setWaveform = useCallback((id: string, peaks: number[]) => dispatch({ type: "SET_WAVEFORM", id, peaks }), []);
  const addMediaAsset = useCallback((asset: MediaAsset) => dispatch({ type: "ADD_MEDIA_ASSET", asset }), []);
  const setAssetThumbnails = useCallback(
    (id: string, thumbnails: string[]) => dispatch({ type: "SET_ASSET_THUMBNAILS", id, thumbnails }),
    [],
  );
  const setAssetWaveform = useCallback((id: string, peaks: number[]) => dispatch({ type: "SET_ASSET_WAVEFORM", id, peaks }), []);
  const addAssetToTimeline = useCallback((assetId: string) => dispatch({ type: "ADD_ASSET_TO_TIMELINE", assetId }), []);
  const selectClip = useCallback((id: string | null) => dispatch({ type: "SELECT_CLIP", id }), []);
  const seek = useCallback((time: number) => dispatch({ type: "SET_CURRENT_TIME", time }), []);
  const play = useCallback(() => dispatch({ type: "PLAY" }), []);
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const togglePlay = useCallback(() => dispatch({ type: "TOGGLE_PLAY" }), []);
  const setZoom = useCallback((zoom: number) => dispatch({ type: "SET_ZOOM", zoom }), []);
  const toggleSnapping = useCallback(() => dispatch({ type: "TOGGLE_SNAPPING" }), []);
  const setCanvasAspectRatio = useCallback(
    (aspectRatio: CanvasAspectRatio) => dispatch({ type: "SET_CANVAS_ASPECT_RATIO", aspectRatio }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const resetProject = useCallback(() => dispatch({ type: "RESET_PROJECT" }), []);

  const videoClips = useMemo(() => state.tracks.filter((clip) => clip.type === "video"), [state.tracks]);
  const audioClips = useMemo(() => state.tracks.filter((clip) => clip.type === "audio"), [state.tracks]);
  const selectedClip = useMemo(
    () => state.tracks.find((clip) => clip.id === state.selectedClipId) ?? null,
    [state.tracks, state.selectedClipId],
  );
  const totalDuration = useMemo(
    () => state.tracks.reduce((max, clip) => Math.max(max, clipTimelineEnd(clip)), 0),
    [state.tracks],
  );

  const value = useMemo<EditorContextValue>(
    () => ({
      state,
      videoClips,
      audioClips,
      selectedClip,
      totalDuration,
      canUndo: state.history.past.length > 0,
      canRedo: state.history.future.length > 0,
      addClip,
      removeClip,
      updateClip,
      splitClipAtPlayhead,
      setThumbnails,
      setWaveform,
      addMediaAsset,
      setAssetThumbnails,
      setAssetWaveform,
      addAssetToTimeline,
      selectClip,
      seek,
      play,
      pause,
      togglePlay,
      setZoom,
      toggleSnapping,
      setCanvasAspectRatio,
      undo,
      redo,
      resetProject,
    }),
    [
      state,
      videoClips,
      audioClips,
      selectedClip,
      totalDuration,
      addClip,
      removeClip,
      updateClip,
      splitClipAtPlayhead,
      setThumbnails,
      setWaveform,
      addMediaAsset,
      setAssetThumbnails,
      setAssetWaveform,
      addAssetToTimeline,
      selectClip,
      seek,
      play,
      pause,
      togglePlay,
      setZoom,
      toggleSnapping,
      setCanvasAspectRatio,
      undo,
      redo,
      resetProject,
    ],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within an <EditorProvider>");
  return ctx;
}
