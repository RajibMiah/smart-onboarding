"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Magnet,
  Maximize,
  Minus,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  Sparkles,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  ZoomIn,
} from "lucide-react";

import { useEditor } from "@/context/EditorContext";
import { clipTimelineDuration, clipTimelineEnd, type TimelineClip } from "@/lib/editor/types";
import { formatTimecode } from "@/lib/editor/media-utils";
import { beginTimeRangeDrag } from "@/lib/editor/timeline-drag";
import { cn } from "@/lib/utils";
import type { ZoomRegion } from "@/types/zoom";

import { BlurTimelineTrack } from "./timeline/BlurTimelineTrack";
import { TextTimelineTrack } from "./timeline/TextTimelineTrack";

const RULER_HEIGHT = 28;
const VIDEO_LANE_HEIGHT = 64;
const ZOOM_LANE_HEIGHT = 28;
const BLUR_LANE_HEIGHT = 28;
const TEXT_LANE_HEIGHT = 28;
const AUDIO_LANE_HEIGHT = 52;
const MIN_CLIP_SECONDS = 0.2;
const MIN_ZOOM_SECONDS = 0.5;
const MIN_VIEW_SECONDS = 30;
const TRAILING_PADDING_SECONDS = 8;
const SNAP_PIXEL_THRESHOLD = 8;

type DragMode = "move" | "trim-start" | "trim-end";

interface TimelineProps {
  onNotify: (message: string) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

export function Timeline({ onNotify, onToggleFullscreen, isFullscreen }: TimelineProps) {
  const {
    state,
    videoClips,
    audioClips,
    selectedClip,
    totalDuration,
    canUndo,
    canRedo,
    updateClip,
    removeClip,
    selectClip,
    splitClipAtPlayhead,
    seek,
    togglePlay,
    setZoom,
    toggleSnapping,
    updateZoomRegion,
    undo,
    redo,
  } = useEditor();

  const contentRef = useRef<HTMLDivElement>(null);
  // Local, non-persisted UI flag — real quality switching arrives with
  // server-side transcoding in a later phase.
  const [hiRes, setHiRes] = useState(false);

  const viewDurationSeconds = Math.max(totalDuration + TRAILING_PADDING_SECONDS, MIN_VIEW_SECONDS);
  const contentWidth = viewDurationSeconds * state.zoomLevel;
  const contentHeight =
    RULER_HEIGHT + VIDEO_LANE_HEIGHT + ZOOM_LANE_HEIGHT + BLUR_LANE_HEIGHT + TEXT_LANE_HEIGHT + AUDIO_LANE_HEIGHT;

  const tickInterval = useMemo(() => pickTickInterval(state.zoomLevel), [state.zoomLevel]);
  const ticks = useMemo(() => {
    const count = Math.ceil(viewDurationSeconds / tickInterval);
    return Array.from({ length: count + 1 }, (_, i) => i * tickInterval);
  }, [viewDurationSeconds, tickInterval]);

  const canCut =
    !!selectedClip && state.currentTime > selectedClip.startOffset && state.currentTime < clipTimelineEnd(selectedClip);

  function scrubToClientX(clientX: number) {
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    const seconds = Math.min(viewDurationSeconds, Math.max(0, (clientX - rect.left) / state.zoomLevel));
    seek(seconds);
  }

  function handleScrubPointerDown(event: React.PointerEvent) {
    event.preventDefault();
    scrubToClientX(event.clientX);
    function onMove(ev: PointerEvent) {
      scrubToClientX(ev.clientX);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function snapToTimeline(time: number, excludeClipId: string): number {
    if (!state.snappingEnabled) return time;
    const thresholdSeconds = SNAP_PIXEL_THRESHOLD / state.zoomLevel;
    const candidates = [0, Math.round(time)];
    for (const clip of state.tracks) {
      if (clip.id === excludeClipId) continue;
      candidates.push(clip.startOffset, clipTimelineEnd(clip));
    }
    let best = time;
    let bestDistance = thresholdSeconds;
    for (const candidate of candidates) {
      const distance = Math.abs(candidate - time);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  }

  function beginClipDrag(event: React.PointerEvent, clip: TimelineClip, mode: DragMode) {
    event.stopPropagation();
    event.preventDefault();
    selectClip(clip.id);

    const startClientX = event.clientX;
    const original = clip;
    // Snapshot history once, before any of this drag's changes are applied,
    // so a single Undo reverts the whole gesture rather than one pixel of it.
    updateClip(clip.id, {}, { commit: true });

    function onMove(ev: PointerEvent) {
      const deltaSeconds = (ev.clientX - startClientX) / state.zoomLevel;

      if (mode === "move") {
        const proposed = Math.max(0, original.startOffset + deltaSeconds);
        updateClip(clip.id, { startOffset: snapToTimeline(proposed, clip.id) });
        return;
      }

      if (mode === "trim-start") {
        let proposedStart = original.startOffset + deltaSeconds;
        proposedStart = snapToTimeline(proposedStart, clip.id);
        let newTrimStart = original.trimStart + (proposedStart - original.startOffset);
        newTrimStart = Math.min(Math.max(newTrimStart, 0), original.trimEnd - MIN_CLIP_SECONDS);
        const newStartOffset = original.startOffset + (newTrimStart - original.trimStart);
        updateClip(clip.id, { trimStart: newTrimStart, startOffset: newStartOffset });
        return;
      }

      // trim-end
      let proposedEnd = original.startOffset + (original.trimEnd - original.trimStart) + deltaSeconds;
      proposedEnd = snapToTimeline(proposedEnd, clip.id);
      let newTrimEnd = original.trimStart + (proposedEnd - original.startOffset);
      newTrimEnd = Math.max(Math.min(newTrimEnd, original.duration), original.trimStart + MIN_CLIP_SECONDS);
      updateClip(clip.id, { trimEnd: newTrimEnd });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function beginZoomDrag(event: React.PointerEvent, region: ZoomRegion, mode: DragMode) {
    beginTimeRangeDrag(event, region, mode, state.zoomLevel, MIN_ZOOM_SECONDS, (changes) => updateZoomRegion(region.id, changes));
  }

  const playheadLeft = state.currentTime * state.zoomLevel;

  return (
    <div className="flex h-72 shrink-0 flex-col border-t-2 border-black bg-white">
      <TimelineToolbar
        canCut={canCut}
        onCut={splitClipAtPlayhead}
        onCleanup={() => onNotify("AI Cleanup isn't available in this offline preview yet.")}
        onOrder={() => onNotify("APC Order isn't available in this offline preview yet.")}
        canDelete={!!selectedClip}
        onDelete={() => selectedClip && removeClip(selectedClip.id)}
        canUndo={canUndo}
        onUndo={undo}
        canRedo={canRedo}
        onRedo={redo}
        isPlaying={state.isPlaying}
        onTogglePlay={togglePlay}
        currentTime={state.currentTime}
        totalDuration={totalDuration}
        snappingEnabled={state.snappingEnabled}
        onToggleSnapping={toggleSnapping}
        zoomLevel={state.zoomLevel}
        onSetZoom={setZoom}
        onToggleFullscreen={onToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      <div className="relative flex-1 overflow-auto">
        <div
          ref={contentRef}
          className="relative"
          style={{ width: contentWidth, height: contentHeight }}
        >
          {/* Ruler */}
          <div
            onPointerDown={handleScrubPointerDown}
            className="sticky top-0 z-10 cursor-pointer border-b-2 border-black bg-white"
            style={{ height: RULER_HEIGHT }}
          >
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex h-full flex-col justify-end"
                style={{ left: t * state.zoomLevel }}
              >
                <div className="h-2 w-px bg-neutral-300" />
                <span className="absolute -top-0.5 left-1.5 text-[10px] text-neutral-500">{t}s</span>
              </div>
            ))}
          </div>

          {/* Video lane */}
          <div
            onPointerDown={handleScrubPointerDown}
            className="relative border-b border-black/15 bg-white"
            style={{ height: VIDEO_LANE_HEIGHT }}
          >
            {videoClips.map((clip) => (
              <VideoClipBlock
                key={clip.id}
                clip={clip}
                zoomLevel={state.zoomLevel}
                laneHeight={VIDEO_LANE_HEIGHT}
                selected={selectedClip?.id === clip.id}
                onSelect={() => selectClip(clip.id)}
                onDragStart={beginClipDrag}
              />
            ))}
          </div>

          {/* Zoom lane */}
          <div
            onPointerDown={handleScrubPointerDown}
            className="relative border-b border-black/15 bg-white"
            style={{ height: ZOOM_LANE_HEIGHT }}
          >
            {state.zoomRegions.map((region) => (
              <ZoomRegionBlock
                key={region.id}
                region={region}
                zoomLevel={state.zoomLevel}
                laneHeight={ZOOM_LANE_HEIGHT}
                onDragStart={beginZoomDrag}
              />
            ))}
          </div>

          <BlurTimelineTrack laneHeight={BLUR_LANE_HEIGHT} onLaneScrub={handleScrubPointerDown} />
          <TextTimelineTrack laneHeight={TEXT_LANE_HEIGHT} onLaneScrub={handleScrubPointerDown} />

          {/* Audio lane — mirrors every clip's own extracted waveform, since
              our recordings/uploads carry embedded audio rather than a
              separate audio-only track. */}
          <div
            onPointerDown={handleScrubPointerDown}
            className="relative bg-white"
            style={{ height: AUDIO_LANE_HEIGHT }}
          >
            {[...videoClips, ...audioClips].map((clip) => (
              <AudioShadowBlock
                key={clip.id}
                clip={clip}
                zoomLevel={state.zoomLevel}
                laneHeight={AUDIO_LANE_HEIGHT}
                onToggleMute={() => updateClip(clip.id, { muted: !clip.muted }, { commit: true })}
              />
            ))}
          </div>

          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 z-20 w-px bg-red-500"
            style={{ left: playheadLeft, height: contentHeight }}
          >
            <div className="absolute -top-0.5 -left-[5px] h-2.5 w-2.5 rotate-45 bg-red-500" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t-2 border-black px-4 py-1.5 text-xs text-neutral-600">
        <HiResToggle enabled={hiRes} onToggle={() => setHiRes((prev) => !prev)} />
        <span>{videoClips.length + audioClips.length} clip(s)</span>
      </div>
    </div>
  );
}

interface TimelineToolbarProps {
  canCut: boolean;
  onCut: () => void;
  onCleanup: () => void;
  onOrder: () => void;
  canDelete: boolean;
  onDelete: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  totalDuration: number;
  snappingEnabled: boolean;
  onToggleSnapping: () => void;
  zoomLevel: number;
  onSetZoom: (zoom: number) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

function TimelineToolbar({
  canCut,
  onCut,
  onCleanup,
  onOrder,
  canDelete,
  onDelete,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  isPlaying,
  onTogglePlay,
  currentTime,
  totalDuration,
  snappingEnabled,
  onToggleSnapping,
  zoomLevel,
  onSetZoom,
  onToggleFullscreen,
  isFullscreen,
}: TimelineToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b-2 border-black px-3 py-2">
      <div className="flex items-center gap-1">
        <ToolbarIconButton icon={ArrowUpDown} label="APC Order" onClick={onOrder} />
        <ToolbarIconButton icon={Scissors} label="Cut" onClick={onCut} disabled={!canCut} />
        <ToolbarIconButton icon={Sparkles} label="Cleanup" onClick={onCleanup} />
        <ToolbarIconButton icon={Trash2} label="Delete" onClick={onDelete} disabled={!canDelete} />
        <div className="mx-1 h-5 w-px bg-black/20" />
        <ToolbarIconButton icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo} />
        <ToolbarIconButton icon={Redo2} label="Redo" onClick={onRedo} disabled={!canRedo} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white transition hover:bg-neutral-800"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <span className="font-mono text-xs tabular-nums text-black">
          {formatTimecode(currentTime)} / {formatTimecode(totalDuration)}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <ToolbarIconButton icon={Magnet} label="Snap to grid" onClick={onToggleSnapping} active={snappingEnabled} />
        <div className="mx-1 flex items-center gap-1">
          <ToolbarIconButton icon={Minus} label="Zoom out" onClick={() => onSetZoom(zoomLevel - 15)} />
          <input
            type="range"
            min={10}
            max={240}
            value={zoomLevel}
            onChange={(event) => onSetZoom(Number(event.target.value))}
            className="w-20 accent-apc-900"
            aria-label="Timeline zoom"
          />
          <ToolbarIconButton icon={Plus} label="Zoom in" onClick={() => onSetZoom(zoomLevel + 15)} />
        </div>
        <ToolbarIconButton icon={Maximize} label="Fullscreen" onClick={onToggleFullscreen} active={isFullscreen} />
      </div>
    </div>
  );
}

function ToolbarIconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: typeof Scissors;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "p-1.5 text-black transition disabled:pointer-events-none disabled:opacity-30",
        active ? "bg-brand-yellow" : "hover:bg-neutral-100",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

interface VideoClipBlockProps {
  clip: TimelineClip;
  zoomLevel: number;
  laneHeight: number;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (event: React.PointerEvent, clip: TimelineClip, mode: DragMode) => void;
}

function VideoClipBlock({ clip, zoomLevel, laneHeight, selected, onSelect, onDragStart }: VideoClipBlockProps) {
  const left = clip.startOffset * zoomLevel;
  const width = Math.max(4, clipTimelineDuration(clip) * zoomLevel);

  return (
    <div
      onPointerDown={(event) => {
        onSelect();
        onDragStart(event, clip, "move");
      }}
      className={cn(
        "absolute top-1.5 flex cursor-grab overflow-hidden border-2 bg-neutral-800 active:cursor-grabbing",
        selected ? "border-brand-yellow" : "border-black/40 hover:border-black",
      )}
      style={{ left, width, height: laneHeight - 12 }}
    >
      <div className="flex h-full w-full">
        {clip.thumbnails.length > 0 ? (
          clip.thumbnails.map((thumb, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- object-URL frame, not a static asset
            <img key={i} src={thumb} alt="" className="h-full flex-1 min-w-0 object-cover" draggable={false} />
          ))
        ) : (
          <div className="h-full w-full animate-pulse bg-neutral-700" />
        )}
      </div>
      <span className="pointer-events-none absolute bottom-1 left-1.5 truncate rounded bg-black/60 px-1 text-[10px] font-medium text-white">
        {clip.name}
      </span>

      <div
        onPointerDown={(event) => onDragStart(event, clip, "trim-start")}
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/30"
      />
      <div
        onPointerDown={(event) => onDragStart(event, clip, "trim-end")}
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/30"
      />
    </div>
  );
}

function ZoomRegionBlock({
  region,
  zoomLevel,
  laneHeight,
  onDragStart,
}: {
  region: ZoomRegion;
  zoomLevel: number;
  laneHeight: number;
  onDragStart: (event: React.PointerEvent, region: ZoomRegion, mode: DragMode) => void;
}) {
  const left = region.startTime * zoomLevel;
  const width = Math.max(4, (region.endTime - region.startTime) * zoomLevel);

  return (
    <div
      onPointerDown={(event) => onDragStart(event, region, "move")}
      className="absolute top-1 flex cursor-grab items-center gap-1 overflow-hidden border-2 border-black bg-brand-yellow px-1.5 active:cursor-grabbing"
      style={{ left, width, height: laneHeight - 8 }}
    >
      <ZoomIn className="h-3 w-3 shrink-0 text-black" />
      <span className="truncate text-[10px] font-bold text-black">{region.scale.toFixed(1)}x Zoom</span>

      <div
        onPointerDown={(event) => onDragStart(event, region, "trim-start")}
        className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20"
      />
      <div
        onPointerDown={(event) => onDragStart(event, region, "trim-end")}
        className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20"
      />
    </div>
  );
}

function AudioShadowBlock({
  clip,
  zoomLevel,
  laneHeight,
  onToggleMute,
}: {
  clip: TimelineClip;
  zoomLevel: number;
  laneHeight: number;
  onToggleMute: () => void;
}) {
  const left = clip.startOffset * zoomLevel;
  const width = Math.max(4, clipTimelineDuration(clip) * zoomLevel);
  const blockHeight = laneHeight - 10;

  return (
    <div
      className="absolute top-1 overflow-hidden border border-black bg-white"
      style={{ left, width, height: blockHeight }}
    >
      <WaveformCanvas peaks={clip.waveformPeaks} widthPx={width} heightPx={blockHeight} color={clip.muted ? "#d4d4d4" : "#000000"} />
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={clip.muted ? "Unmute clip" : "Mute clip"}
        aria-pressed={clip.muted}
        className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center border border-black bg-white/90 text-black transition hover:bg-brand-yellow"
      >
        {clip.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      </button>
    </div>
  );
}

function WaveformCanvas({
  peaks,
  widthPx,
  heightPx,
  color,
}: {
  peaks: number[];
  widthPx: number;
  heightPx: number;
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(widthPx * dpr));
    canvas.height = Math.max(1, Math.round(heightPx * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, widthPx, heightPx);
    ctx.fillStyle = color;

    if (peaks.length === 0) {
      ctx.fillRect(0, heightPx / 2 - 1, widthPx, 2);
      return;
    }

    const barWidth = Math.max(1, widthPx / peaks.length);
    peaks.forEach((peak, i) => {
      const barHeight = Math.max(2, peak * (heightPx - 4));
      ctx.fillRect(i * barWidth, (heightPx - barHeight) / 2, Math.max(1, barWidth - 0.5), barHeight);
    });
  }, [peaks, widthPx, heightPx, color]);

  return <canvas ref={canvasRef} style={{ width: widthPx, height: heightPx }} className="block" />;
}

function pickTickInterval(zoomLevel: number): number {
  const candidates = [1, 2, 5, 10, 15, 30, 60];
  return candidates.find((seconds) => seconds * zoomLevel >= 50) ?? 60;
}

function HiResToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-2">
      <span>Switch to Hi-res</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        title="Toggle a higher-quality preview (proxy switching lands with server-side transcoding)"
        className={cn(
          "relative h-4 w-8 rounded-full transition",
          enabled ? "bg-black" : "bg-neutral-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
            enabled ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
