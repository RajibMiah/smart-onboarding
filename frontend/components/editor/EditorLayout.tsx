"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Cloud, Trash2 } from "lucide-react";

import { Toast } from "@/components/ui/Toast";
import { useEditor } from "@/context/EditorContext";
import { useMediaIngestion } from "@/hooks/useMediaIngestion";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useStudioTool } from "@/hooks/useStudioTool";
import { useToast } from "@/hooks/useToast";
import type { StudioTool } from "@/types/studio";

import { StudioDrawer } from "./StudioDrawer";
import { StudioToolRail } from "./StudioToolRail";
import { Timeline } from "./Timeline";
import { VideoCanvas } from "./VideoCanvas";
import { StudioUploadModal } from "./modals/StudioUploadModal";
import { AudioPanel } from "./panels/AudioPanel";
import { AutoEditPanel } from "./panels/AutoEditPanel";
import { BlurPanel } from "./panels/BlurPanel";
import { ElementsPanel } from "./panels/ElementsPanel";
import { MediaPanel } from "./panels/MediaPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { TextPanel } from "./panels/TextPanel";
import { ZoomPanel } from "./panels/ZoomPanel";

/**
 * Complete Video Studio & Timeline Editor shell. The `EditorProvider` now
 * lives in `app/studio/layout.tsx` (a sibling to this page and to
 * `/studio/review`) so the same editing session survives the client-side
 * navigation to the review step instead of resetting.
 */
export const EditorLayout = () => {
  return <EditorLayoutInner />;
};

const EditorLayoutInner = () => {
  const {
    videoClips,
    selectedClip,
    removeClip,
    undo,
    redo,
    togglePlay,
    splitClipAtPlayhead,
    resetProject,
    state,
    cancelZoomDrawing,
    openUploadModal,
  } = useEditor();
  const router = useRouter();
  const toast = useToast();
  const { ingest } = useMediaIngestion();
  const studioTool = useStudioTool("media");

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

  const openMediaPanel = useCallback(() => studioTool.openTool("media"), [studioTool]);

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
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Global editor shortcuts — ignored while typing in a form field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable)) return;

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
      } else if (event.key === "Escape" && state.isDrawingZoom) {
        event.preventDefault();
        cancelZoomDrawing();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, selectedClip, removeClip, undo, redo, splitClipAtPlayhead, state.isDrawingZoom, cancelZoomDrawing]);

  const handleDeleteProject = useCallback(() => {
    if (videoClips.length === 0) return;
    if (window.confirm("Delete this APC project? This clears every clip and cannot be undone.")) {
      resetProject();
    }
  }, [videoClips.length, resetProject]);

  const renderActivePanel = (tool: StudioTool): ReactNode => {
    switch (tool) {
      case "auto-edit":
        return <AutoEditPanel onNotify={toast.show} />;
      case "media":
        return (
          <MediaPanel
            isRecording={recorder.isRecording}
            recordingSource={recorder.recordingSource}
            onStartScreenRecording={recorder.startScreenRecording}
            onStartCameraRecording={recorder.startCameraRecording}
            onStopRecording={recorder.stopRecording}
            onTurnSlides={handleTurnSlides}
          />
        );
      case "audio":
        return <AudioPanel onNotify={toast.show} />;
      case "blur":
        return <BlurPanel onNotify={toast.show} />;
      case "text":
        return <TextPanel onNotify={toast.show} />;
      case "elements":
        return <ElementsPanel onNotify={toast.show} />;
      case "zoom":
        return <ZoomPanel onNotify={toast.show} />;
      case "settings":
        return <SettingsPanel onNotify={toast.show} />;
      default:
        return null;
    }
  };

  return (
    <div ref={studioRef} className="flex h-screen flex-col bg-white">
      <EditorHeader onDeleteProject={handleDeleteProject} onNext={() => router.push("/studio/review")} />

      <div className="flex min-h-0 flex-1">
        <StudioToolRail
          activeTool={studioTool.activeTool}
          isDrawerOpen={studioTool.isDrawerOpen}
          isRailExpanded={studioTool.isRailExpanded}
          onSelectTool={studioTool.selectTool}
          onToggleExpanded={studioTool.toggleRailExpanded}
        />

        <StudioDrawer activeTool={studioTool.activeTool} isOpen={studioTool.isDrawerOpen} onCollapse={studioTool.closeDrawer}>
          {renderActivePanel(studioTool.activeTool)}
        </StudioDrawer>

        <VideoCanvas
          onStartScreenRecording={recorder.startScreenRecording}
          onStartCameraRecording={recorder.startCameraRecording}
          onTriggerUpload={openUploadModal}
          onOpenLibrary={openMediaPanel}
          onTurnSlides={handleTurnSlides}
        />
      </div>

      <Timeline onNotify={toast.show} onToggleFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />

      <StudioUploadModal />
      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};

const EditorHeader = ({ onDeleteProject, onNext }: { onDeleteProject: () => void; onNext: () => void }) => {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-black px-4">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center bg-black text-xs font-bold text-white">
          APC
        </span>
        <span className="text-sm font-semibold text-black">AI Paper Clip Studio</span>
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
};
