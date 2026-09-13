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
import type { BlurRegion, BoundingBox, ImageOverlay, TextRegion } from "@/types/overlays";
import type { ZoomRegion, ZoomRegionBounds } from "@/types/zoom";

const MAX_HISTORY = 50;
const DEFAULT_ZOOM_DURATION_SECONDS = 3;
const DEFAULT_ZOOM_SCALE = 1.5;
const DEFAULT_OVERLAY_DURATION_SECONDS = 3;
const DEFAULT_BLUR_RADIUS = 16;
const DEFAULT_IMAGE_OVERLAY_SIZE = 0.3;

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
  zoomRegions: ZoomRegion[];
  /** True while the video canvas is in marquee-drawing mode for a new zoom region. */
  isDrawingZoom: boolean;
  blurRegions: BlurRegion[];
  isDrawingBlur: boolean;
  /** Which blur region's move/resize handles are showing on canvas, if any. */
  selectedBlurId: string | null;
  textRegions: TextRegion[];
  selectedTextId: string | null;
  imageOverlays: ImageOverlay[];
  selectedImageOverlayId: string | null;
  history: { past: TimelineClip[][]; future: TimelineClip[][] };
  /** Set when this session was opened to resume editing a previously-saved clip, so
   *  Review knows to update that clip instead of creating a new one on save. */
  projectClipId: string | null;
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
  | { type: "START_ZOOM_DRAWING" }
  | { type: "CANCEL_ZOOM_DRAWING" }
  | { type: "ADD_ZOOM_REGION"; region: ZoomRegion }
  | { type: "UPDATE_ZOOM_REGION"; id: string; changes: Partial<ZoomRegion> }
  | { type: "REMOVE_ZOOM_REGION"; id: string }
  | { type: "START_BLUR_DRAWING" }
  | { type: "CANCEL_BLUR_DRAWING" }
  | { type: "ADD_BLUR_REGION"; region: BlurRegion }
  | { type: "UPDATE_BLUR_REGION"; id: string; changes: Partial<BlurRegion> }
  | { type: "REMOVE_BLUR_REGION"; id: string }
  | { type: "SELECT_BLUR_REGION"; id: string | null }
  | { type: "ADD_TEXT_REGION"; region: TextRegion }
  | { type: "UPDATE_TEXT_REGION"; id: string; changes: Partial<TextRegion> }
  | { type: "REMOVE_TEXT_REGION"; id: string }
  | { type: "SELECT_TEXT_REGION"; id: string | null }
  | { type: "ADD_IMAGE_OVERLAY"; overlay: ImageOverlay }
  | { type: "UPDATE_IMAGE_OVERLAY"; id: string; changes: Partial<ImageOverlay> }
  | { type: "REMOVE_IMAGE_OVERLAY"; id: string }
  | { type: "SELECT_IMAGE_OVERLAY"; id: string | null }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET_PROJECT" }
  | {
      type: "LOAD_PROJECT";
      /** A real backend Clip id when resuming a saved clip; null for a local-only IndexedDB draft restore. */
      clipId: string | null;
      tracks: TimelineClip[];
      zoomRegions: ZoomRegion[];
      blurRegions: BlurRegion[];
      textRegions: TextRegion[];
      imageOverlays: ImageOverlay[];
    };

const INITIAL_STATE: EditorState = {
  tracks: [],
  mediaBin: [],
  currentTime: 0,
  isPlaying: false,
  zoomLevel: 60,
  selectedClipId: null,
  snappingEnabled: true,
  canvasAspectRatio: "16:9",
  zoomRegions: [],
  isDrawingZoom: false,
  blurRegions: [],
  isDrawingBlur: false,
  selectedBlurId: null,
  textRegions: [],
  selectedTextId: null,
  imageOverlays: [],
  selectedImageOverlayId: null,
  history: { past: [], future: [] },
  projectClipId: null,
};

/** Deep-enough clone for history snapshots (clips are flat data + string[] arrays). */
const cloneTracks = (tracks: TimelineClip[]): TimelineClip[] => {
  return tracks.map((clip) => ({ ...clip, thumbnails: [...clip.thumbnails], waveformPeaks: [...clip.waveformPeaks] }));
};

const withHistorySnapshot = (state: EditorState): EditorState["history"] => {
  const past = [...state.history.past, cloneTracks(state.tracks)].slice(-MAX_HISTORY);
  return { past, future: [] };
};

const editorReducer = (state: EditorState, action: Action): EditorState => {
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

    case "START_ZOOM_DRAWING":
      return { ...state, isDrawingZoom: true };

    case "CANCEL_ZOOM_DRAWING":
      return { ...state, isDrawingZoom: false };

    case "ADD_ZOOM_REGION":
      return { ...state, zoomRegions: [...state.zoomRegions, action.region], isDrawingZoom: false };

    case "UPDATE_ZOOM_REGION":
      return {
        ...state,
        zoomRegions: state.zoomRegions.map((region) => (region.id === action.id ? { ...region, ...action.changes } : region)),
      };

    case "REMOVE_ZOOM_REGION":
      return { ...state, zoomRegions: state.zoomRegions.filter((region) => region.id !== action.id) };

    case "START_BLUR_DRAWING":
      return { ...state, isDrawingBlur: true };

    case "CANCEL_BLUR_DRAWING":
      return { ...state, isDrawingBlur: false };

    case "ADD_BLUR_REGION":
      return { ...state, blurRegions: [...state.blurRegions, action.region], isDrawingBlur: false, selectedBlurId: action.region.id };

    case "UPDATE_BLUR_REGION":
      return {
        ...state,
        blurRegions: state.blurRegions.map((region) => (region.id === action.id ? { ...region, ...action.changes } : region)),
      };

    case "REMOVE_BLUR_REGION":
      return {
        ...state,
        blurRegions: state.blurRegions.filter((region) => region.id !== action.id),
        selectedBlurId: state.selectedBlurId === action.id ? null : state.selectedBlurId,
      };

    case "SELECT_BLUR_REGION":
      return { ...state, selectedBlurId: action.id };

    case "ADD_TEXT_REGION":
      return { ...state, textRegions: [...state.textRegions, action.region], selectedTextId: action.region.id };

    case "UPDATE_TEXT_REGION":
      return {
        ...state,
        textRegions: state.textRegions.map((region) => (region.id === action.id ? { ...region, ...action.changes } : region)),
      };

    case "REMOVE_TEXT_REGION":
      return {
        ...state,
        textRegions: state.textRegions.filter((region) => region.id !== action.id),
        selectedTextId: state.selectedTextId === action.id ? null : state.selectedTextId,
      };

    case "SELECT_TEXT_REGION":
      return { ...state, selectedTextId: action.id };

    case "ADD_IMAGE_OVERLAY":
      return { ...state, imageOverlays: [...state.imageOverlays, action.overlay], selectedImageOverlayId: action.overlay.id };

    case "UPDATE_IMAGE_OVERLAY":
      return {
        ...state,
        imageOverlays: state.imageOverlays.map((overlay) => (overlay.id === action.id ? { ...overlay, ...action.changes } : overlay)),
      };

    case "REMOVE_IMAGE_OVERLAY":
      return {
        ...state,
        imageOverlays: state.imageOverlays.filter((overlay) => overlay.id !== action.id),
        selectedImageOverlayId: state.selectedImageOverlayId === action.id ? null : state.selectedImageOverlayId,
      };

    case "SELECT_IMAGE_OVERLAY":
      return { ...state, selectedImageOverlayId: action.id };

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

    case "LOAD_PROJECT":
      return {
        ...INITIAL_STATE,
        tracks: action.tracks,
        zoomRegions: action.zoomRegions,
        blurRegions: action.blurRegions,
        textRegions: action.textRegions,
        imageOverlays: action.imageOverlays,
        projectClipId: action.clipId,
      };

    default:
      return state;
  }
};

interface EditorContextValue {
  state: EditorState;
  videoClips: TimelineClip[];
  audioClips: TimelineClip[];
  selectedClip: TimelineClip | null;
  totalDuration: number;
  canUndo: boolean;
  canRedo: boolean;
  /** The zoom region (if any) covering the current playhead. */
  activeZoomRegion: ZoomRegion | null;
  /** Blur/text regions covering the current playhead — several can be visible at once, unlike zoom. */
  activeBlurRegions: BlurRegion[];
  activeTextRegions: TextRegion[];
  activeImageOverlays: ImageOverlay[];

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
  startZoomDrawing: () => void;
  cancelZoomDrawing: () => void;
  addZoomRegion: (bounds: ZoomRegionBounds) => void;
  updateZoomRegion: (id: string, changes: Partial<ZoomRegion>) => void;
  removeZoomRegion: (id: string) => void;
  startBlurDrawing: () => void;
  cancelBlurDrawing: () => void;
  addBlurRegion: (bounds: BoundingBox) => void;
  updateBlurRegion: (id: string, changes: Partial<BlurRegion>) => void;
  removeBlurRegion: (id: string) => void;
  selectBlurRegion: (id: string | null) => void;
  addTextRegion: (preset: { content: string; bounds: BoundingBox; style: TextRegion["style"] }) => void;
  updateTextRegion: (id: string, changes: Partial<TextRegion>) => void;
  removeTextRegion: (id: string) => void;
  selectTextRegion: (id: string | null) => void;
  addImageOverlay: (input: { src: string; bounds?: BoundingBox; mediaAssetId?: string | null }) => string;
  updateImageOverlay: (id: string, changes: Partial<ImageOverlay>) => void;
  removeImageOverlay: (id: string) => void;
  selectImageOverlay: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  resetProject: () => void;
  loadProject: (payload: {
    clipId: string | null;
    tracks: TimelineClip[];
    zoomRegions: ZoomRegion[];
    blurRegions: BlurRegion[];
    textRegions: TextRegion[];
    imageOverlays: ImageOverlay[];
  }) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export const EditorProvider = ({ children }: { children: ReactNode }) => {
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
  const startZoomDrawing = useCallback(() => dispatch({ type: "START_ZOOM_DRAWING" }), []);
  const cancelZoomDrawing = useCallback(() => dispatch({ type: "CANCEL_ZOOM_DRAWING" }), []);
  const addZoomRegion = useCallback(
    (bounds: ZoomRegionBounds) => {
      dispatch({
        type: "ADD_ZOOM_REGION",
        region: {
          id: crypto.randomUUID(),
          name: `Zoom ${state.zoomRegions.length + 1}`,
          startTime: state.currentTime,
          endTime: state.currentTime + DEFAULT_ZOOM_DURATION_SECONDS,
          scale: DEFAULT_ZOOM_SCALE,
          bounds,
        },
      });
    },
    [state.currentTime, state.zoomRegions.length],
  );
  const updateZoomRegion = useCallback(
    (id: string, changes: Partial<ZoomRegion>) => dispatch({ type: "UPDATE_ZOOM_REGION", id, changes }),
    [],
  );
  const removeZoomRegion = useCallback((id: string) => dispatch({ type: "REMOVE_ZOOM_REGION", id }), []);
  const startBlurDrawing = useCallback(() => dispatch({ type: "START_BLUR_DRAWING" }), []);
  const cancelBlurDrawing = useCallback(() => dispatch({ type: "CANCEL_BLUR_DRAWING" }), []);
  const addBlurRegion = useCallback(
    (bounds: BoundingBox) => {
      dispatch({
        type: "ADD_BLUR_REGION",
        region: {
          id: crypto.randomUUID(),
          name: `Blur ${state.blurRegions.length + 1}`,
          startTime: state.currentTime,
          endTime: state.currentTime + DEFAULT_OVERLAY_DURATION_SECONDS,
          shape: "rectangle",
          blurRadius: DEFAULT_BLUR_RADIUS,
          feather: false,
          bounds,
        },
      });
    },
    [state.currentTime, state.blurRegions.length],
  );
  const updateBlurRegion = useCallback(
    (id: string, changes: Partial<BlurRegion>) => dispatch({ type: "UPDATE_BLUR_REGION", id, changes }),
    [],
  );
  const removeBlurRegion = useCallback((id: string) => dispatch({ type: "REMOVE_BLUR_REGION", id }), []);
  const selectBlurRegion = useCallback((id: string | null) => dispatch({ type: "SELECT_BLUR_REGION", id }), []);
  const addTextRegion = useCallback(
    (preset: { content: string; bounds: BoundingBox; style: TextRegion["style"] }) => {
      dispatch({
        type: "ADD_TEXT_REGION",
        region: {
          id: crypto.randomUUID(),
          content: preset.content,
          startTime: state.currentTime,
          endTime: state.currentTime + DEFAULT_OVERLAY_DURATION_SECONDS,
          bounds: preset.bounds,
          style: preset.style,
        },
      });
    },
    [state.currentTime],
  );
  const updateTextRegion = useCallback(
    (id: string, changes: Partial<TextRegion>) => dispatch({ type: "UPDATE_TEXT_REGION", id, changes }),
    [],
  );
  const removeTextRegion = useCallback((id: string) => dispatch({ type: "REMOVE_TEXT_REGION", id }), []);
  const selectTextRegion = useCallback((id: string | null) => dispatch({ type: "SELECT_TEXT_REGION", id }), []);
  const addImageOverlay = useCallback(
    (input: { src: string; bounds?: BoundingBox; mediaAssetId?: string | null }) => {
      const id = crypto.randomUUID();
      dispatch({
        type: "ADD_IMAGE_OVERLAY",
        overlay: {
          id,
          name: `Overlay ${state.imageOverlays.length + 1}`,
          src: input.src,
          startTime: state.currentTime,
          endTime: state.currentTime + DEFAULT_OVERLAY_DURATION_SECONDS,
          bounds: input.bounds ?? {
            x: (1 - DEFAULT_IMAGE_OVERLAY_SIZE) / 2,
            y: (1 - DEFAULT_IMAGE_OVERLAY_SIZE) / 2,
            width: DEFAULT_IMAGE_OVERLAY_SIZE,
            height: DEFAULT_IMAGE_OVERLAY_SIZE,
          },
          mediaAssetId: input.mediaAssetId ?? null,
        },
      });
      return id;
    },
    [state.currentTime, state.imageOverlays.length],
  );
  const updateImageOverlay = useCallback(
    (id: string, changes: Partial<ImageOverlay>) => dispatch({ type: "UPDATE_IMAGE_OVERLAY", id, changes }),
    [],
  );
  const removeImageOverlay = useCallback((id: string) => dispatch({ type: "REMOVE_IMAGE_OVERLAY", id }), []);
  const selectImageOverlay = useCallback((id: string | null) => dispatch({ type: "SELECT_IMAGE_OVERLAY", id }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const resetProject = useCallback(() => dispatch({ type: "RESET_PROJECT" }), []);
  const loadProject = useCallback(
    (payload: {
      clipId: string | null;
      tracks: TimelineClip[];
      zoomRegions: ZoomRegion[];
      blurRegions: BlurRegion[];
      textRegions: TextRegion[];
      imageOverlays: ImageOverlay[];
    }) => dispatch({ type: "LOAD_PROJECT", ...payload }),
    [],
  );

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
  const activeZoomRegion = useMemo(
    () => state.zoomRegions.find((region) => state.currentTime >= region.startTime && state.currentTime < region.endTime) ?? null,
    [state.zoomRegions, state.currentTime],
  );
  const activeBlurRegions = useMemo(
    () => state.blurRegions.filter((region) => state.currentTime >= region.startTime && state.currentTime < region.endTime),
    [state.blurRegions, state.currentTime],
  );
  const activeTextRegions = useMemo(
    () => state.textRegions.filter((region) => state.currentTime >= region.startTime && state.currentTime < region.endTime),
    [state.textRegions, state.currentTime],
  );
  const activeImageOverlays = useMemo(
    () => state.imageOverlays.filter((overlay) => state.currentTime >= overlay.startTime && state.currentTime < overlay.endTime),
    [state.imageOverlays, state.currentTime],
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
      activeZoomRegion,
      activeBlurRegions,
      activeTextRegions,
      activeImageOverlays,
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
      startZoomDrawing,
      cancelZoomDrawing,
      addZoomRegion,
      updateZoomRegion,
      removeZoomRegion,
      startBlurDrawing,
      cancelBlurDrawing,
      addBlurRegion,
      updateBlurRegion,
      removeBlurRegion,
      selectBlurRegion,
      addTextRegion,
      updateTextRegion,
      removeTextRegion,
      selectTextRegion,
      addImageOverlay,
      updateImageOverlay,
      removeImageOverlay,
      selectImageOverlay,
      undo,
      redo,
      resetProject,
      loadProject,
    }),
    [
      state,
      videoClips,
      audioClips,
      selectedClip,
      totalDuration,
      activeZoomRegion,
      activeBlurRegions,
      activeTextRegions,
      activeImageOverlays,
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
      startZoomDrawing,
      cancelZoomDrawing,
      addZoomRegion,
      updateZoomRegion,
      removeZoomRegion,
      startBlurDrawing,
      cancelBlurDrawing,
      addBlurRegion,
      updateBlurRegion,
      removeBlurRegion,
      selectBlurRegion,
      addTextRegion,
      updateTextRegion,
      removeTextRegion,
      selectTextRegion,
      addImageOverlay,
      updateImageOverlay,
      removeImageOverlay,
      selectImageOverlay,
      undo,
      redo,
      resetProject,
      loadProject,
    ],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

export const useEditor = (): EditorContextValue => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within an <EditorProvider>");
  return ctx;
};
