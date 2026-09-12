"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, FileVideo, RotateCcw, UploadCloud, X } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";
import { useModal } from "@/hooks/useModal";
import { useFileUpload } from "@/hooks/useFileUpload";
import { ACCEPTED_UPLOAD_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES, type UploadItem } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

export const UPLOAD_MODAL_ID = "upload-files";

const ACCEPT_ATTRIBUTE = ACCEPTED_UPLOAD_EXTENSIONS.join(",");

function UploadModalImpl() {
  const { isOpen, close } = useModal(UPLOAD_MODAL_ID);
  const { items, addFiles, removeItem, cancelItem, retryItem } = useFileUpload();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingOver(false);
      if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
    },
    [addFiles],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-overlay-in"
        onClick={close}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-popover animate-modal-in"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="upload-modal-title" className="text-base font-semibold text-slate-900">
            Upload files
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close upload dialog"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
              isDraggingOver ? "border-apc-accent bg-apc-accent/5" : "border-slate-200",
            )}
          >
            <UploadCloud className="h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600">
              Drag and drop files here, or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-medium text-apc-900 underline underline-offset-2"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-slate-400">
              {ACCEPTED_UPLOAD_EXTENSIONS.join(", ")} · up to {formatBytes(MAX_UPLOAD_SIZE_BYTES)}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {items.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((item) => (
                <UploadRow key={item.id} item={item} onCancel={cancelItem} onRetry={retryItem} onRemove={removeItem} />
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface UploadRowProps {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

function UploadRow({ item, onCancel, onRetry, onRemove }: UploadRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
      <FileVideo className="h-5 w-5 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-slate-800">{item.file.name}</p>
          <span className="shrink-0 text-xs text-slate-400">{formatBytes(item.file.size)}</span>
        </div>

        {item.status === "uploading" && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-apc-accent transition-[width]"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}

        {item.status === "error" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" /> {item.error}
          </p>
        )}

        {item.status === "success" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
          </p>
        )}

        {item.status === "cancelled" && <p className="mt-1 text-xs text-slate-400">Cancelled</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.status === "uploading" && (
          <button
            type="button"
            onClick={() => onCancel(item.id)}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={`Cancel upload of ${item.file.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {(item.status === "error" || item.status === "cancelled") && (
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={`Retry upload of ${item.file.name}`}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        {item.status !== "uploading" && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
            aria-label={`Remove ${item.file.name} from list`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

export const UploadModal = withPortal(UploadModalImpl);
