"use client";

import { Video } from "lucide-react";

import type { ProcessingStatus } from "@/types/review";

interface VideoProcessingViewportProps {
  status: ProcessingStatus;
  /** The reviewed clip's playable URL — present once `status` is "ready". */
  src?: string;
}

/** Processing spinner, empty state, or the actual playable clip, depending on `status`. */
export const VideoProcessingViewport = ({ status, src }: VideoProcessingViewportProps) => {
  return (
    <div className="relative mx-auto flex aspect-video w-full max-w-5xl flex-col items-center justify-center overflow-hidden border border-black bg-neutral-100">
      {status === "processing" && (
        <>
          <p className="text-sm font-medium text-neutral-600">Your APC project is being processed</p>
          <div
            role="status"
            aria-label="Processing"
            className="my-4 h-10 w-10 animate-spin rounded-full border-4 border-neutral-300 border-t-black"
          />
          <p className="text-xs text-neutral-400">May take: 1 minute</p>
        </>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <Video className="h-8 w-8 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-600">No clip to review yet</p>
          <p className="text-xs text-neutral-400">Record or upload something in the editor first.</p>
        </div>
      )}

      {status === "ready" &&
        (src ? (
          <video src={src} controls className="h-full w-full bg-black object-contain">
            <track kind="captions" />
          </video>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Video className="h-8 w-8 text-neutral-400" />
            <p className="text-sm font-medium text-neutral-600">No clip to review yet</p>
          </div>
        ))}
    </div>
  );
};
