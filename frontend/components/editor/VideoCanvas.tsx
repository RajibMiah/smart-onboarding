"use client";

import { useRef, useState } from "react";
import { Camera, FolderOpen, Plus, ScanLine, Upload, UploadCloud } from "lucide-react";

import { useEditor } from "@/context/EditorContext";
import { useTimelinePlayback } from "@/hooks/useTimelinePlayback";
import type { CanvasAspectRatio } from "@/lib/editor/types";

const ASPECT_RATIO_CSS: Record<CanvasAspectRatio, string> = {
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "1:1": "1 / 1",
};

/** Below this drag distance (in px), a marquee attempt is treated as a stray click, not a region. */
const MIN_ZOOM_DRAG_PX = 12;

interface DragBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface VideoCanvasProps {
  onStartScreenRecording: () => void;
  onStartCameraRecording: () => void;
  onTriggerUpload: () => void;
  onOpenLibrary: () => void;
  onTurnSlides: () => void;
}

export function VideoCanvas({
  onStartScreenRecording,
  onStartCameraRecording,
  onTriggerUpload,
  onOpenLibrary,
  onTurnSlides,
}: VideoCanvasProps) {
  const { videoClips, state, activeZoomRegion, addZoomRegion, cancelZoomDrawing } = useEditor();
  const { videoRef, activeClip } = useTimelinePlayback();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [dragBox, setDragBox] = useState<DragBox | null>(null);

  const hasMedia = videoClips.length > 0;

  // Transform-origin (not translate) is what actually places the zoom: scaling
  // around the region's own center reaches the same visual result as a
  // scale+translate pair, without the extra offset math — and as the scale
  // eases back to 1 on exit, the origin's position stops mattering, so the
  // exit reads as smooth even though the origin snaps back immediately.
  const videoTransform = activeZoomRegion ? `scale(${activeZoomRegion.scale})` : "scale(1)";
  const videoTransformOrigin = activeZoomRegion
    ? `${(activeZoomRegion.bounds.x + activeZoomRegion.bounds.width / 2) * 100}% ${(activeZoomRegion.bounds.y + activeZoomRegion.bounds.height / 2) * 100}%`
    : "50% 50%";

  function handleMarqueePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const rect = canvasBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = { x: clamp(event.clientX - rect.left, 0, rect.width), y: clamp(event.clientY - rect.top, 0, rect.height) };
    dragOriginRef.current = origin;
    setDragBox({ left: origin.x, top: origin.y, width: 0, height: 0 });
  }

  function handleMarqueePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const origin = dragOriginRef.current;
    const rect = canvasBoxRef.current?.getBoundingClientRect();
    if (!origin || !rect) return;
    const currentX = clamp(event.clientX - rect.left, 0, rect.width);
    const currentY = clamp(event.clientY - rect.top, 0, rect.height);
    setDragBox({
      left: Math.min(origin.x, currentX),
      top: Math.min(origin.y, currentY),
      width: Math.abs(currentX - origin.x),
      height: Math.abs(currentY - origin.y),
    });
  }

  function handleMarqueePointerUp() {
    const rect = canvasBoxRef.current?.getBoundingClientRect();
    if (rect && dragBox && dragBox.width > MIN_ZOOM_DRAG_PX && dragBox.height > MIN_ZOOM_DRAG_PX) {
      addZoomRegion({
        x: dragBox.left / rect.width,
        y: dragBox.top / rect.height,
        width: dragBox.width / rect.width,
        height: dragBox.height / rect.height,
      });
    } else {
      cancelZoomDrawing();
    }
    dragOriginRef.current = null;
    setDragBox(null);
  }

  return (
    <section className="relative flex min-w-0 flex-1 items-center justify-center bg-neutral-900 p-6">
      {state.isDrawingZoom && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 border-2 border-black bg-brand-yellow px-3 py-1.5 text-xs font-semibold text-black shadow-popover">
          Draw a rectangle to set the zoom area
        </div>
      )}

      {/* The <video> element is mounted persistently (not conditionally) so
          useTimelinePlayback's ref never goes stale between clip switches.
          The wrapping box reshapes to the Settings panel's aspect-ratio
          choice; `visibility` (not `display`) keeps it in flow so the empty
          state below can sit in the same stacking context without a jump
          when media first loads. */}
      <div
        ref={canvasBoxRef}
        className="relative flex h-full max-h-full w-auto max-w-full items-center justify-center overflow-hidden"
        style={{ aspectRatio: ASPECT_RATIO_CSS[state.canvasAspectRatio] }}
      >
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain shadow-popover"
          style={{
            visibility: hasMedia ? "visible" : "hidden",
            transform: videoTransform,
            transformOrigin: videoTransformOrigin,
            transition: "transform 300ms ease",
          }}
          playsInline
        />

        {state.isDrawingZoom && (
          <div
            onPointerDown={handleMarqueePointerDown}
            onPointerMove={handleMarqueePointerMove}
            onPointerUp={handleMarqueePointerUp}
            className="absolute inset-0 z-20 cursor-crosshair"
          >
            {dragBox && (
              <div
                className="pointer-events-none absolute border-2 border-brand-yellow bg-brand-yellow/20"
                style={{ left: dragBox.left, top: dragBox.top, width: dragBox.width, height: dragBox.height }}
              />
            )}
          </div>
        )}
      </div>

      {hasMedia && !activeClip && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
          No clip at the playhead
        </div>
      )}

      {!hasMedia && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center border-2 border-white/30">
            <Plus className="h-7 w-7 text-neutral-300" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">Start creating</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Record, upload, or choose how you want to create an APC project.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <ActionPill icon={ScanLine} label="Screen Recording" onClick={onStartScreenRecording} />
            <ActionPill icon={Camera} label="Camera Capture" onClick={onStartCameraRecording} />
            <ActionPill icon={Upload} label="Upload Files" onClick={onTriggerUpload} />
            <ActionPill icon={FolderOpen} label="Add from Library" onClick={onOpenLibrary} />
            <ActionPill icon={UploadCloud} label="Turn Slides into APC" onClick={onTurnSlides} />
          </div>

          <button
            type="button"
            onClick={() => setShortcutsOpen((prev) => !prev)}
            className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
          >
            Keyboard Shortcuts (?)
          </button>

          {shortcutsOpen && (
            <div className="w-64 border-2 border-white/20 bg-neutral-800 p-3 text-left text-xs text-neutral-300">
              <ShortcutRow keys="Space" action="Play / pause" />
              <ShortcutRow keys="Delete" action="Delete selected clip" />
              <ShortcutRow keys="Ctrl / ⌘ + Z" action="Undo" />
              <ShortcutRow keys="Ctrl / ⌘ + Shift + Z" action="Redo" />
              <ShortcutRow keys="S" action="Split clip at playhead" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ActionPill({ icon: Icon, label, onClick }: { icon: typeof Camera; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 border border-white/30 bg-neutral-800 px-3.5 py-2 text-xs font-medium text-neutral-200 transition hover:border-brand-yellow hover:bg-neutral-700"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-neutral-400">{action}</span>
      <kbd className="border border-white/30 bg-black px-1.5 py-0.5 font-mono text-[10px] text-white">{keys}</kbd>
    </div>
  );
}
