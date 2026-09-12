"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Cloud,
  MoreHorizontal,
  Music,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Toast } from "@/components/ui/Toast";
import { EditorProvider, useEditor } from "@/context/EditorContext";
import { useMediaIngestion } from "@/hooks/useMediaIngestion";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useToast } from "@/hooks/useToast";
import { probeMediaDuration } from "@/lib/editor/media-utils";
import { cn } from "@/lib/utils";

import { MediaDrawer } from "./MediaDrawer";
import { Timeline } from "./Timeline";
import { VideoCanvas } from "./VideoCanvas";

type ToolPanel = "auto-edit" | "media" | "audio" | "more";

/** Complete Video Studio & Timeline Editor shell — self-contained, owns its own state provider. */
export function EditorLayout() {
  return (
    <EditorProvider>
      <EditorLayoutInner />
    </EditorProvider>
  );
}

function EditorLayoutInner() {
  const { videoClips, selectedClip, removeClip, undo, redo, togglePlay, splitClipAtPlayhead, resetProject } = useEditor();
  const toast = useToast();
  const { ingest } = useMediaIngestion();

  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activePanel, setActivePanel] = useState<ToolPanel>("media");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const studioRef = useRef<HTMLDivElement>(null);

  const handleRecordingComplete = useCallback(
    (result: { url: string; durationSeconds: number; name: string }) => {
      ingest({ src: result.url, name: result.name, duration: result.durationSeconds, type: "video" });
    },
    [ingest],
  );

  const recorder = useMediaRecorder({ onComplete: handleRecordingComplete });

  useEffect(() => {
    if (recorder.error) toast.show(recorder.error);
  }, [recorder.error, toast]);

  const openMediaPanel = useCallback(() => {
    setActivePanel("media");
    setDrawerOpen(true);
  }, []);

  const handleUploadFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        if (file.type === "application/pdf") {
          toast.show("PDF-to-recording conversion isn't available in this offline preview yet.");
          continue;
        }
        const url = URL.createObjectURL(file);
        try {
          const duration = await probeMediaDuration(url);
          ingest({ src: url, name: file.name, duration, type: "video" });
        } catch {
          toast.show(`Couldn't read "${file.name}" — is it a valid video file?`);
        }
      }
    },
    [ingest, toast],
  );

  const handleTurnSlides = useCallback(() => {
    toast.show("Turning slides into a recording isn't available in this offline preview yet.");
  }, [toast]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      studioRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Global editor shortcuts — ignored while typing in a form field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedClip) {
          event.preventDefault();
          removeClip(selectedClip.id);
        }
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key.toLowerCase() === "s" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        splitClipAtPlayhead();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, selectedClip, removeClip, undo, redo, splitClipAtPlayhead]);

  const handleDeleteProject = useCallback(() => {
    if (videoClips.length === 0) return;
    if (window.confirm("Delete this APC project? This clears every clip and cannot be undone.")) {
      resetProject();
    }
  }, [videoClips.length, resetProject]);

  return (
    <div ref={studioRef} className="flex h-screen flex-col bg-white">
      <EditorHeader onDeleteProject={handleDeleteProject} onNext={() => toast.show("Publishing isn't available in this offline preview yet.")} />

      <div className="flex min-h-0 flex-1">
        <ToolRail
          activePanel={activePanel}
          drawerOpen={drawerOpen}
          onSelectPanel={(panel) => {
            if (panel === "auto-edit" || panel === "more") {
              toast.show(`${panel === "auto-edit" ? "Auto-edit" : "More tools"} isn't available in this offline preview yet.`);
              return;
            }
            if (activePanel === panel && drawerOpen) {
              setDrawerOpen(false);
            } else {
              setActivePanel(panel);
              setDrawerOpen(true);
            }
          }}
        />

        {drawerOpen && activePanel === "media" && (
          <MediaDrawer
            isRecording={recorder.isRecording}
            recordingSource={recorder.recordingSource}
            onStartScreenRecording={recorder.startScreenRecording}
            onStartCameraRecording={recorder.startCameraRecording}
            onStopRecording={recorder.stopRecording}
            onUploadFiles={handleUploadFiles}
            onTurnSlides={handleTurnSlides}
            onCollapse={() => setDrawerOpen(false)}
          />
        )}

        {drawerOpen && activePanel === "audio" && (
          <aside className="flex w-80 shrink-0 items-center justify-center border-r-2 border-black bg-white p-6 text-center text-sm text-neutral-500">
            Audio-only capture and library tools aren&apos;t available in this offline preview yet.
          </aside>
        )}

        <VideoCanvas
          onStartScreenRecording={recorder.startScreenRecording}
          onStartCameraRecording={recorder.startCameraRecording}
          onTriggerUpload={() => {
            openMediaPanel();
            toast.show('Use the "Upload" button in the Media panel to choose files.');
          }}
          onOpenLibrary={openMediaPanel}
          onTurnSlides={handleTurnSlides}
        />
      </div>

      <Timeline onNotify={toast.show} onToggleFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
}

function EditorHeader({ onDeleteProject, onNext }: { onDeleteProject: () => void; onNext: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-black px-4">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center bg-black text-xs font-bold text-white">
          APC
        </span>
        <span className="text-sm font-semibold text-black">AI Paper Click Studio</span>
      </Link>

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Cloud className="h-3.5 w-3.5" /> Saved
        </span>
        <button
          type="button"
          onClick={onDeleteProject}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete APC Project
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-1.5 border-2 border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          Next <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function ToolRail({
  activePanel,
  drawerOpen,
  onSelectPanel,
}: {
  activePanel: ToolPanel;
  drawerOpen: boolean;
  onSelectPanel: (panel: ToolPanel) => void;
}) {
  const items: { id: ToolPanel; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: "auto-edit", label: "Auto-edit", icon: Sparkles },
    { id: "media", label: "Media", icon: Clapperboard },
    { id: "audio", label: "Audio", icon: Music },
    { id: "more", label: "More", icon: MoreHorizontal },
  ];

  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r-2 border-black bg-white py-3">
      {items.map(({ id, label, icon: Icon }) => {
        const active = activePanel === id && drawerOpen;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectPanel(id)}
            title={label}
            aria-pressed={active}
            className={cn(
              "flex w-12 flex-col items-center gap-1 py-2 text-[10px] font-medium transition",
              active ? "bg-brand-yellow text-black" : "text-neutral-500 hover:bg-neutral-100",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
