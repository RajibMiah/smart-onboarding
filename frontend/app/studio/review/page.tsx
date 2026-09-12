"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Captions, ChevronDown, Languages, MoreHorizontal, Pencil, Share2 } from "lucide-react";

import { DocumentationEditor } from "@/components/review/DocumentationEditor";
import { PlaylistAssigner } from "@/components/review/PlaylistAssigner";
import { ReviewHeader } from "@/components/review/ReviewHeader";
import { VideoProcessingViewport } from "@/components/review/VideoProcessingViewport";
import { Toast } from "@/components/ui/Toast";
import { useEditor } from "@/context/EditorContext";
import { useReviewWorkflow } from "@/hooks/useReviewWorkflow";
import { useToast } from "@/hooks/useToast";

function defaultProjectTitle(): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `APC on ${date} at ${time}`;
}

export default function ReviewPage() {
  const router = useRouter();
  const toast = useToast();
  const { videoClips, totalDuration } = useEditor();
  const hasMedia = videoClips.length > 0;
  // There's no timeline-compositing/export pipeline yet, so the reviewed
  // "project" stands in for the first clip on the timeline rather than a
  // real rendered-together final video.
  const primaryClip = videoClips[0] ?? null;

  const [initialTitle] = useState(defaultProjectTitle);
  const workflow = useReviewWorkflow({ initialTitle, hasMedia });
  const [titleDraft, setTitleDraft] = useState(initialTitle);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ReviewHeader
        onEditClick={() => router.push("/studio")}
        isPublished={workflow.isPublished}
        onTogglePublished={() => workflow.setIsPublished((prev) => !prev)}
        onEnableVersioning={() => toast.show("Versioning isn't available in this offline preview yet.")}
        onDone={() => workflow.handleSaveAndFinish(totalDuration)}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
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

        <VideoProcessingViewport status={workflow.processingStatus} src={primaryClip?.src} />

        <MediaSubToolbar
          onCreateSubtitles={() => toast.show("Subtitles aren't available in this offline preview yet.")}
          onTranslations={() => toast.show("Translations aren't available in this offline preview yet.")}
          onShare={() => toast.show("Sharing isn't available in this offline preview yet.")}
          onMore={() => toast.show("More options aren't available in this offline preview yet.")}
        />

        <PlaylistAssigner
          playlists={workflow.playlists}
          selectedPlaylistId={workflow.selectedPlaylistId}
          onSelect={workflow.selectPlaylist}
          onCreate={workflow.createPlaylist}
          error={workflow.playlistError}
        />

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
      </main>

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
}

function MediaSubToolbar({
  onCreateSubtitles,
  onTranslations,
  onShare,
  onMore,
}: {
  onCreateSubtitles: () => void;
  onTranslations: () => void;
  onShare: () => void;
  onMore: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
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
}
