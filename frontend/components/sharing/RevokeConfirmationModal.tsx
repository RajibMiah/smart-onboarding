"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";

interface RevokeConfirmationModalProps {
  isOpen: boolean;
  isRevoking: boolean;
  recipientLabel: string;
  contentTitle: string;
  /** Names of anyone downstream who was delegated access off this share —
   *  revoking cascades to all of them too. */
  downstreamRecipients: string[];
  onCancel: () => void;
  onConfirm: () => void;
}

function RevokeConfirmationModalImpl({
  isOpen,
  isRevoking,
  recipientLabel,
  contentTitle,
  downstreamRecipients,
  onCancel,
  onConfirm,
}: RevokeConfirmationModalProps) {
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
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" onClick={isRevoking ? undefined : onCancel} aria-hidden="true" />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="revoke-modal-title"
        className="relative w-full max-w-md border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-modal-in"
      >
        <div className="flex items-center gap-2 border-b border-black pb-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          <h2 id="revoke-modal-title" className="font-mono text-lg font-bold text-rose-600">
            Revoke Access?
          </h2>
        </div>

        <div className="flex flex-col gap-3 py-4 text-sm text-neutral-700">
          <p>
            This removes <span className="font-semibold text-black">{recipientLabel}</span>&apos;s access to{" "}
            <span className="font-semibold text-black">&quot;{contentTitle}&quot;</span> immediately.
          </p>

          {downstreamRecipients.length > 0 && (
            <div className="border border-black bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <p className="font-semibold">
                {downstreamRecipients.length} downstream recipient{downstreamRecipients.length === 1 ? "" : "s"} will also lose
                access:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {downstreamRecipients.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isRevoking}
            className="border border-black px-4 py-2 text-xs font-bold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isRevoking}
            className="border border-black bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRevoking ? "Revoking…" : "✕ Revoke Access"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const RevokeConfirmationModal = withPortal(RevokeConfirmationModalImpl);
