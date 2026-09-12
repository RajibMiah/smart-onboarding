"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  Camera,
  ChevronDown,
  Film,
  FolderOpen,
  MoreVertical,
  ScanLine,
  Upload,
  UploadCloud,
} from "lucide-react";

import { useEditor } from "@/context/EditorContext";
import { useClickOutside } from "@/hooks/useClickOutside";
import type { RecordingSource } from "@/hooks/useMediaRecorder";
import { formatTimecode } from "@/lib/editor/media-utils";
import { clipTimelineDuration, type MediaAsset, type TimelineClip } from "@/lib/editor/types";
import { cn } from "@/lib/utils";

const ACCEPTED_UPLOAD_TYPES = ".mp4,.mov,.webm";

interface MediaDrawerProps {
  isRecording: boolean;
  recordingSource: RecordingSource | null;
  onStartScreenRecording: () => void;
  onStartCameraRecording: () => void;
  onStopRecording: () => void;
  onUploadFiles: (files: FileList) => void;
  onTurnSlides: () => void;
  onCollapse: () => void;
}

type DrawerTab = "timeline" | "previous";

export function MediaDrawer({
  isRecording,
  recordingSource,
  onStartScreenRecording,
  onStartCameraRecording,
  onStopRecording,
  onUploadFiles,
  onTurnSlides,
  onCollapse,
}: MediaDrawerProps) {
  const {
    videoClips,
    state: { mediaBin },
    selectedClip,
    selectClip,
    addAssetToTimeline,
    removeClip,
    resetProject,
  } = useEditor();
  const [activeTab, setActiveTab] = useState<DrawerTab>("timeline");
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) onUploadFiles(event.target.files);
    event.target.value = "";
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r-2 border-black bg-white">
      <div className="flex items-center justify-between border-b-2 border-black px-4 py-3">
        <span className="text-sm font-bold text-black">Media</span>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse media panel"
          className="p-1 text-black transition hover:bg-neutral-100"
        >
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        <QuickActionButton
          icon={ScanLine}
          label={isRecording && recordingSource === "screen" ? "Stop recording" : "Screen Recording"}
          active={isRecording && recordingSource === "screen"}
          onClick={isRecording && recordingSource === "screen" ? onStopRecording : onStartScreenRecording}
        />
        <QuickActionButton
          icon={Camera}
          label={isRecording && recordingSource === "camera" ? "Stop recording" : "Camera Capture"}
          active={isRecording && recordingSource === "camera"}
          onClick={isRecording && recordingSource === "camera" ? onStopRecording : onStartCameraRecording}
        />
        <QuickActionButton icon={Upload} label="Upload" onClick={() => fileInputRef.current?.click()} />
        <QuickActionButton icon={UploadCloud} label="Turn Slides into APC" onClick={onTurnSlides} />
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_UPLOAD_TYPES}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex items-center justify-between border-b-2 border-black px-3">
        <div className="flex gap-4">
          <TabButton label="In Timeline" active={activeTab === "timeline"} onClick={() => setActiveTab("timeline")} />
          <TabButton label="Previous Medias" active={activeTab === "previous"} onClick={() => setActiveTab("previous")} />
        </div>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="More media options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="p-1.5 text-black transition hover:bg-neutral-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-1 w-44 border-2 border-black bg-white py-1 shadow-popover animate-modal-in"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  if (videoClips.length && window.confirm("Remove every clip from the timeline?")) resetProject();
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Clear timeline
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "timeline" ? (
          videoClips.length === 0 ? (
            <EmptyState message="No media yet — upload files or record to get started." />
          ) : (
            <div className="flex flex-col gap-2">
              {videoClips.map((clip) => (
                <TimelineClipTile
                  key={clip.id}
                  clip={clip}
                  selected={selectedClip?.id === clip.id}
                  onSelect={() => selectClip(clip.id)}
                  onRemove={() => removeClip(clip.id)}
                />
              ))}
            </div>
          )
        ) : mediaBin.length === 0 ? (
          <EmptyState message="No previous media yet — anything you record or upload is kept here." />
        ) : (
          <div className="flex flex-col gap-2">
            {mediaBin.map((asset) => (
              <BinAssetTile key={asset.id} asset={asset} onAdd={() => addAssetToTimeline(asset.id)} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Camera;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 border-2 p-3 text-left text-xs font-medium transition",
        active ? "border-red-400 bg-red-50 text-red-700" : "border-black text-black hover:bg-neutral-100",
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-red-600" : "text-black")} />
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 py-2 text-xs font-medium transition",
        active ? "border-black font-bold text-black" : "border-transparent text-neutral-500 hover:text-black",
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 border-2 border-dashed border-black p-6 text-center">
      <Film className="h-6 w-6 text-neutral-400" />
      <p className="text-xs text-neutral-500">{message}</p>
    </div>
  );
}

function TimelineClipTile({
  clip,
  selected,
  onSelect,
  onRemove,
}: {
  clip: TimelineClip;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && onSelect()}
      className={cn(
        "group relative flex cursor-grab items-center gap-2 border-2 p-1.5 transition active:cursor-grabbing",
        selected ? "border-black bg-brand-yellow/10" : "border-black/20 hover:border-black",
      )}
    >
      <div className="relative h-11 w-16 shrink-0 overflow-hidden border border-black bg-neutral-800">
        {clip.thumbnails[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- object-URL thumbnails, not a static asset
          <img src={clip.thumbnails[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full animate-pulse bg-neutral-700" />
        )}
        <span className="absolute bottom-0.5 right-0.5 bg-black/80 px-1 text-[9px] font-medium text-white">
          {formatTimecode(clipTimelineDuration(clip))}
        </span>
      </div>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-black">{clip.name}</span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className="p-1 text-neutral-400 opacity-0 transition hover:bg-neutral-200 hover:text-black group-hover:opacity-100"
        aria-label={`Remove ${clip.name}`}
      >
        &times;
      </button>
    </div>
  );
}

function BinAssetTile({ asset, onAdd }: { asset: MediaAsset; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-full items-center gap-2 border-2 border-black/20 p-1.5 text-left transition hover:border-black hover:bg-neutral-100"
    >
      <div className="relative h-11 w-16 shrink-0 overflow-hidden border border-black bg-neutral-800">
        {asset.thumbnails[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- object-URL thumbnails, not a static asset
          <img src={asset.thumbnails[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-700">
            <FolderOpen className="h-4 w-4 text-neutral-400" />
          </div>
        )}
        <span className="absolute bottom-0.5 right-0.5 bg-black/80 px-1 text-[9px] font-medium text-white">
          {formatTimecode(asset.duration)}
        </span>
      </div>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-black">{asset.name}</span>
    </button>
  );
}
