"use client";

import { useEffect } from "react";
import { Trash2 } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  isDeleting: boolean;
  contentType: "clip" | "playlist";
  title: string;
  /** Clip only — how many distinct playlists it's currently in. */
  playlistCount?: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Destructive-action gate for deleting a Clip or Playlist from the library —
 * previously this fired straight from the "···" menu's Delete item with no
 * confirmation at all.
 */
function DeleteConfirmationModalImpl({
  isOpen,
  isDeleting,
  contentType,
  title,
  playlistCount = 0,
  onCancel,
  onConfirm,
}: DeleteConfirmationModalProps) {
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

  const label = contentType === "clip" ? "Clip" : "Playlist";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" onClick={isDeleting ? undefined : onCancel} aria-hidden="true" />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-body"
        className="relative w-full max-w-md border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-modal-in"
      >
        <div className="flex items-center gap-2 border-b border-black pb-2">
          <Trash2 className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          <h2 id="delete-modal-title" className="font-mono text-lg font-bold text-rose-600">
            Delete {label}?
          </h2>
        </div>

        <div id="delete-modal-body" className="flex flex-col gap-3 py-4 text-sm text-neutral-700">
          <p className="truncate font-semibold text-black">&quot;{title}&quot;</p>

          <p className="border border-black bg-rose-50 px-3 py-2 text-xs text-rose-700">
            This action cannot be undone. All associated timeline cuts, zoom keyframes, overlays, and share links will
            be permanently removed.
          </p>

          {contentType === "clip" ? (
            playlistCount > 0 && (
              <p className="text-xs text-neutral-500">
                This clip is present in {playlistCount} playlist{playlistCount === 1 ? "" : "s"}. It will be
                unlinked from {playlistCount === 1 ? "it" : "them"}.
              </p>
            )
          ) : (
            <p className="text-xs text-neutral-500">
              The playlist container will be deleted, but the underlying video clips will remain in your library.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="border border-black px-4 py-2 text-xs font-bold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="border border-black bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Confirm Delete ➔"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const DeleteConfirmationModal = withPortal(DeleteConfirmationModalImpl);
