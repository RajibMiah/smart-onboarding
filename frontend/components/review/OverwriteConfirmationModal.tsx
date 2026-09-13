"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";

interface OverwriteConfirmationModalProps {
  isOpen: boolean;
  isSaving: boolean;
  /** The playlist this clip is already in — shown by name in the warning copy. */
  playlistName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Gate in front of `handleSaveAndFinish` specifically for Case 1 of the
 * Review page's save routing: re-saving into the SAME playlist a clip is
 * already in overwrites it in place — destructive enough (no undo once it's
 * live) to ask for one explicit confirmation first. Saving into a
 * *different* playlist instead forks a new clip and skips this modal
 * entirely (see `app/studio/review/page.tsx`).
 */
function OverwriteConfirmationModalImpl({ isOpen, isSaving, playlistName, onCancel, onConfirm }: OverwriteConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" onClick={onCancel} aria-hidden="true" />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="overwrite-modal-title"
        aria-describedby="overwrite-modal-body"
        className="relative w-full max-w-md border border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-modal-in"
      >
        <div className="flex items-center gap-2 border-b border-black pb-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-black" />
          <h2 id="overwrite-modal-title" className="font-bold text-black">
            Video Already Exists in Playlist
          </h2>
        </div>

        <p id="overwrite-modal-body" className="py-4 text-sm text-neutral-700">
          This video is already in &quot;{playlistName}&quot;. Saving will permanently overwrite and replace the
          previous version with your new edits.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="border border-black px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="border border-black bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Overwrite & Replace ➔"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const OverwriteConfirmationModal = withPortal(OverwriteConfirmationModalImpl);
