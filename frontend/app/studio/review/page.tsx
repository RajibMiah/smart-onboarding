"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Captions, ChevronDown, Languages, MoreHorizontal, Pencil, Share2 } from "lucide-react";

import { AppliedEditsSummary } from "@/components/review/AppliedEditsSummary";
import { DocumentationEditor } from "@/components/review/DocumentationEditor";
import { OverwriteConfirmationModal } from "@/components/review/OverwriteConfirmationModal";
import { PlaylistAssigner } from "@/components/review/PlaylistAssigner";
import { ReviewHeader } from "@/components/review/ReviewHeader";
import { VideoProcessingViewport } from "@/components/review/VideoProcessingViewport";
import { VideoReviewPlayer, type VideoReviewPlayerHandle } from "@/components/review/VideoReviewPlayer";
import { Toast } from "@/components/ui/Toast";
import { useEditor } from "@/context/EditorContext";
import { useReviewWorkflow } from "@/hooks/useReviewWorkflow";
import { useToast } from "@/hooks/useToast";
import { defaultProjectTitle } from "@/lib/editor/project-defaults";
import type { ProjectMetadataPayload } from "@/types/project";

const ReviewPage = () => {
  const router = useRouter();
  const toast = useToast();
  const { state, videoClips, totalDuration } = useEditor();
  const hasMedia = videoClips.length > 0;
  // There's no timeline-compositing/export pipeline yet, so the reviewed
  // "project" stands in for the first clip on the timeline rather than a
  // real rendered-together final video.
  const primaryClip = videoClips[0] ?? null;
  const playerRef = useRef<VideoReviewPlayerHandle>(null);

  const [initialTitle] = useState(defaultProjectTitle);
  const workflow = useReviewWorkflow({ initialTitle, hasMedia });
  const [titleDraft, setTitleDraft] = useState(initialTitle);
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);
  const isExistingProject = workflow.isExistingProject;
  // Case 1 (same playlist as before): overwrite in place, behind one
  // confirmation. Case 2 (different playlist, or no known original):
  // fork a brand-new clip instead — see handleSaveAndFinish's `forceNew`.
  const isSameProjectPlaylist =
    isExistingProject && workflow.originalPlaylistId !== null && workflow.selectedPlaylistId === workflow.originalPlaylistId;
  const originalPlaylistName = workflow.playlists.find((playlist) => playlist.id === workflow.originalPlaylistId)?.title ?? "";

  // The canonical playback-engine payload — `VideoReviewPlayer` only reads the
  // media/edit fields, but the type is shared with the backend/IndexedDB shape
  // so any consumer can take the same object.
  const project = useMemo<ProjectMetadataPayload>(
    () => ({
      id: state.projectClipId ?? "",
      title: workflow.projectTitle,
      description: workflow.description,
      status: workflow.isPublished ? "published" : "draft",
      duration: totalDuration,
      primaryMediaId: primaryClip?.id ?? "",
      primaryMediaUrl: primaryClip?.src ?? "",
      thumbnailUrl: "",
      assignedPlaylistId: workflow.selectedPlaylistId,
      language: "en-US",
      filters: state.filters,
      cuts: state.cuts,
      zoomRegions: state.zoomRegions,
      blurRegions: state.blurRegions,
      textOverlays: state.textRegions,
      createdAt: "",
      updatedAt: "",
    }),
    [
      state.projectClipId,
      state.filters,
      state.cuts,
      state.zoomRegions,
      state.blurRegions,
      state.textRegions,
      workflow.projectTitle,
      workflow.description,
      workflow.isPublished,
      workflow.selectedPlaylistId,
      totalDuration,
      primaryClip,
    ],
  );

  const seekPreview = (seconds: number) => playerRef.current?.seekTo(seconds);

  const handleDoneClick = () => {
    // Case 1: saving back into the same playlist this clip is already in —
    // that's an overwrite, destructive enough (no undo once it's live) to
    // confirm first.
    if (isSameProjectPlaylist) {
      setIsOverwriteModalOpen(true);
      return;
    }
    // Case 2: a first-time save, or re-saving into a *different* playlist —
    // fork a new clip rather than silently rewriting the one still
    // referenced from its original playlist.
    void workflow.handleSaveAndFinish(totalDuration, { forceNew: isExistingProject && !isSameProjectPlaylist });
  };

  const confirmOverwrite = () => {
    void workflow.handleSaveAndFinish(totalDuration).finally(() => setIsOverwriteModalOpen(false));
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ReviewHeader
        // Preserving the clip id keeps the URL correct if the user refreshes
        // back in Studio — without it, a resumed project's in-memory state
        // would be gone with nothing in the URL to reload it from.
        onEditClick={() => router.push(state.projectClipId ? `/studio?clip=${state.projectClipId}` : "/studio")}
        isPublished={workflow.isPublished}
        onTogglePublished={() => workflow.setIsPublished((prev) => !prev)}
        onEnableVersioning={() => toast.show("Versioning isn't available in this offline preview yet.")}
        onDone={handleDoneClick}
        isSaving={workflow.isSaving}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex items-center gap-2">
          {workflow.isEditingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => workflow.commitTitle(titleDraft)}
              onKeyDown={(event) => event.key === "Enter" && workflow.commitTitle(titleDraft)}
              aria-label="Project title"
              className="w-full border-b-2 border-black text-2xl font-bold text-black outline-none"
            />
          ) : (
            <>
              <h1 className="text-2xl font-bold text-black">{workflow.projectTitle}</h1>
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(workflow.projectTitle);
                  workflow.startEditingTitle();
                }}
                aria-label="Edit project title"
                className="text-neutral-400 transition hover:text-black"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {workflow.processingStatus === "ready" && primaryClip ? (
          <VideoReviewPlayer ref={playerRef} project={project} />
        ) : (
          <VideoProcessingViewport status={workflow.processingStatus} />
        )}

        <MediaSubToolbar
          onCreateSubtitles={() => toast.show("Subtitles aren't available in this offline preview yet.")}
          onTranslations={() => toast.show("Translations aren't available in this offline preview yet.")}
          onShare={() => toast.show("Sharing isn't available in this offline preview yet.")}
          onMore={() => toast.show("More options aren't available in this offline preview yet.")}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <DocumentationEditor
              description={workflow.description}
              onDescriptionChange={workflow.setDescription}
              onAutoCreateDescription={() => toast.show("Auto-create description isn't available in this offline preview yet.")}
              onAttachFile={() => toast.show("Attaching files isn't available in this offline preview yet.")}
              steps={workflow.steps}
              onAddStep={() => workflow.addStep(0)}
              onUpdateStep={workflow.updateStep}
              onRemoveStep={workflow.removeStep}
            />
          </div>

          <div className="flex flex-col gap-6 lg:col-span-2">
            <PlaylistAssigner
              playlists={workflow.playlists}
              selectedPlaylistId={workflow.selectedPlaylistId}
              onSelect={workflow.selectPlaylist}
              onCreate={workflow.createPlaylist}
              error={workflow.playlistError}
            />
            <AppliedEditsSummary onSeek={seekPreview} />
          </div>
        </div>
      </main>

      {toast.message && <Toast message={toast.message} />}

      <OverwriteConfirmationModal
        isOpen={isOverwriteModalOpen}
        isSaving={workflow.isSaving}
        playlistName={originalPlaylistName}
        onCancel={() => setIsOverwriteModalOpen(false)}
        onConfirm={confirmOverwrite}
      />
    </div>
  );
};
export default ReviewPage;

const MediaSubToolbar = ({
  onCreateSubtitles,
  onTranslations,
  onShare,
  onMore,
}: {
  onCreateSubtitles: () => void;
  onTranslations: () => void;
  onShare: () => void;
  onMore: () => void;
}) => {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            defaultValue="en-US"
            aria-label="Video language"
            className="appearance-none border border-black bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="en-US">English (US)</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black" />
        </div>

        <button
          type="button"
          onClick={onCreateSubtitles}
          className="flex items-center gap-1.5 border border-black px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-100"
        >
          <Captions className="h-3.5 w-3.5" />
          Create subtitles
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onTranslations}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-100"
        >
          <Languages className="h-3.5 w-3.5" />
          Translations
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-100"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
        <button
          type="button"
          onClick={onMore}
          aria-label="More options"
          className="p-1.5 text-black transition hover:bg-neutral-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
