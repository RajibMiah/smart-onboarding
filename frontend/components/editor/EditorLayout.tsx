"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Cloud, Loader2, Trash2 } from "lucide-react";

import { Toast } from "@/components/ui/Toast";
import { useEditor } from "@/context/EditorContext";
import { useMediaIngestion } from "@/hooks/useMediaIngestion";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useStudioPersistence } from "@/hooks/useStudioPersistence";
import { useStudioTool } from "@/hooks/useStudioTool";
import { useToast } from "@/hooks/useToast";
import { clearLocalProjectId, defaultProjectTitle, getOrCreateLocalProjectId } from "@/lib/editor/project-defaults";
import type { SaveStatus } from "@/types/storage";
import type { StudioTool } from "@/types/studio";

import { StudioDrawer } from "./StudioDrawer";
import { StudioToolRail } from "./StudioToolRail";
import { Timeline } from "./Timeline";
import { VideoCanvas } from "./VideoCanvas";
import { StudioUploadModal } from "./modals/StudioUploadModal";
import { AudioPanel } from "./panels/AudioPanel";
import { AutoEditPanel } from "./panels/AutoEditPanel";
import { BlurPanel } from "./panels/BlurPanel";
import { CutsPanel } from "./panels/CutsPanel";
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

  // A `?clip=` session resumes an existing backend clip — app/studio/page.tsx
  // already hydrates and mirrors that one to/from IndexedDB itself, keyed by
  // the real clip id, so persistence here is scoped to the other case: a
  // brand-new recording that has no backend id yet and, until Review's
  // "Done", would otherwise live only as an in-memory blob URL — gone for
  // good on a crash or an accidental reload.
  const isFreshRecordingSession = !useSearchParams().get("clip");
  const localProjectId = useMemo(() => getOrCreateLocalProjectId(), []);
  const [projectTitle] = useState(defaultProjectTitle);
  const persistence = useStudioPersistence({
    projectId: localProjectId,
    title: projectTitle,
    enabled: isFreshRecordingSession,
  });

  const handleRecordingComplete = useCallback(
    (result: { url: string; durationSeconds: number; name: string }) => {
      ingest({ src: result.url, name: result.name, duration: result.durationSeconds, type: "video" });
      // The whole point is that a freshly recorded clip is durable the
      // instant recording stops — waiting for the debounced autosave would
      // leave a multi-second window where a crash still loses it.
      void persistence.saveNow();
    },
    [ingest, persistence],
  );

  const recorder = useMediaRecorder({ onComplete: handleRecordingComplete });

  useEffect(() => {
    if (recorder.error) toast.show(recorder.error);
  }, [recorder.error, toast]);

  useEffect(() => {
    if (persistence.errorMessage) toast.show(persistence.errorMessage);
  }, [persistence.errorMessage, toast]);

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
      if (isFreshRecordingSession) {
        void persistence.discardDraft();
        clearLocalProjectId();
      }
    }
  }, [videoClips.length, resetProject, isFreshRecordingSession, persistence]);

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
      case "cuts":
        return <CutsPanel onNotify={toast.show} />;
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

  // Only a fresh-recording session restores anything here — gating first
  // paint on a `?clip=` session's own (separate) network/IndexedDB load
  // is app/studio/page.tsx's job, not this hook's.
  if (isFreshRecordingSession && persistence.isRestoring) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        <p className="text-sm text-neutral-500">Restoring your last session…</p>
      </div>
    );
  }

  return (
    <div ref={studioRef} className="flex h-screen flex-col bg-white">
      <EditorHeader
        onDeleteProject={handleDeleteProject}
        onNext={() => router.push("/studio/review")}
        saveStatus={isFreshRecordingSession ? persistence.saveStatus : "idle"}
      />

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

const EditorHeader = ({
  onDeleteProject,
  onNext,
  saveStatus,
}: {
  onDeleteProject: () => void;
  onNext: () => void;
  saveStatus: SaveStatus;
}) => {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-black px-4">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center bg-black text-xs font-bold text-white">
          APC
        </span>
        <span className="text-sm font-semibold text-black">AI Paper Clip Studio</span>
      </Link>

      <div className="flex items-center gap-2">
        <SaveStatusIndicator status={saveStatus} />
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

/** Reflects `useStudioPersistence`'s real local-save state — replacing what
 *  used to be a hardcoded "Saved" label regardless of whether anything had
 *  actually been saved. "idle" (a `?clip=` session, which persists through
 *  its own separate flow instead) reads the same as "saved" here rather than
 *  showing a state that would just raise unanswerable questions. */
const SaveStatusIndicator = ({ status }: { status: SaveStatus }) => {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-600">
        <AlertTriangle className="h-3.5 w-3.5" /> Not saved
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
      <Cloud className="h-3.5 w-3.5" /> Saved
    </span>
  );
};
