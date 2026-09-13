"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Film, Layers, Upload, X } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";
import { useModal } from "@/hooks/useModal";
import { MEDIA_ACCEPT, OVERLAY_ACCEPT, useStudioUpload, type UploadKind, type UploadTask } from "@/hooks/useStudioUpload";
import { formatBytes } from "@/lib/utils";

export const STUDIO_UPLOAD_MODAL_ID = "studio-upload";

const OPTIONS: {
  kind: UploadKind;
  icon: typeof Film;
  title: string;
  description: string;
  accept: string;
  hint: string;
}[] = [
  {
    kind: "media",
    icon: Film,
    title: "Upload a Media",
    description: "Add videos or images from your device",
    accept: MEDIA_ACCEPT,
    hint: ".mp4, .mov, .webm — up to 500MB",
  },
  {
    kind: "overlay",
    icon: Layers,
    title: "Upload an Overlay",
    description: "Add an overlay on top of your video",
    accept: OVERLAY_ACCEPT,
    hint: ".png, .svg, .gif, .webp — up to 20MB",
  },
];

function StudioUploadModalImpl() {
  const { isOpen, close } = useModal(STUDIO_UPLOAD_MODAL_ID);
  const { tasks, uploadFiles, dismissTask } = useStudioUpload();
  const [selectedKind, setSelectedKind] = useState<UploadKind | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const selectedOption = OPTIONS.find((option) => option.kind === selectedKind) ?? null;
  const visibleTasks = selectedKind ? tasks.filter((task) => task.kind === selectedKind) : [];

  function handleClose() {
    setSelectedKind(null);
    setIsDragOver(false);
    close();
  }

  function chooseOption(kind: UploadKind) {
    setSelectedKind(kind);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length && selectedKind) uploadFiles(event.target.files, selectedKind);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files.length && selectedKind) uploadFiles(event.dataTransfer.files, selectedKind);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={(event) => event.key === "Escape" && handleClose()}
    >
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" onClick={handleClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-upload-title"
        className="relative w-full max-w-md border border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-modal-in"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {selectedOption ? (
              <button
                type="button"
                onClick={() => setSelectedKind(null)}
                aria-label="Back to upload options"
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-black text-black transition hover:bg-neutral-100"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-black bg-brand-yellow text-black">
                <Upload className="h-4 w-4" />
              </span>
            )}
            <div>
              <h2 id="studio-upload-title" className="text-base font-bold text-black">
                {selectedOption ? selectedOption.title : "Upload"}
              </h2>
              <p className="text-xs text-neutral-500">
                {selectedOption ? selectedOption.hint : "Choose what you want to upload"}
              </p>
            </div>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close" className="p-1 text-black transition hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          {!selectedOption ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => chooseOption(option.kind)}
                  className="flex flex-col items-start gap-2 border border-black p-4 text-left transition hover:bg-neutral-50"
                >
                  <option.icon className="h-5 w-5 text-black" />
                  <span className="text-sm font-bold text-black">{option.title}</span>
                  <span className="text-xs text-neutral-500">{option.description}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={
                  isDragOver
                    ? "flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-black bg-yellow-50 p-8 text-center transition"
                    : "flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-black/30 p-8 text-center transition hover:border-black"
                }
              >
                <selectedOption.icon className="h-6 w-6 text-black" />
                <p className="text-sm font-semibold text-black">Drag &amp; drop, or click to browse</p>
                <p className="text-xs text-neutral-500">{selectedOption.hint}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={selectedOption.accept}
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {visibleTasks.length > 0 && (
                <div className="flex flex-col gap-2">
                  {visibleTasks.map((task) => (
                    <UploadTaskRow key={task.id} task={task} onDismiss={() => dismissTask(task.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadTaskRow({ task, onDismiss }: { task: UploadTask; onDismiss: () => void }) {
  return (
    <div className="border border-black p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-black">{task.file.name}</span>
        <span className="shrink-0 text-[11px] text-neutral-500">{formatBytes(task.file.size)}</span>
        {task.status !== "uploading" && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 p-0.5 text-neutral-400 hover:text-black">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {task.status === "uploading" && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 border border-black bg-neutral-100">
            <div className="h-full bg-black transition-all" style={{ width: `${task.progress}%` }} />
          </div>
          <span className="font-mono text-[11px] font-semibold text-black">{task.progress}%</span>
        </div>
      )}

      {task.status === "success" && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
        </p>
      )}

      {task.status === "error" && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5" /> {task.error}
        </p>
      )}
    </div>
  );
}

export const StudioUploadModal = withPortal(StudioUploadModalImpl);
