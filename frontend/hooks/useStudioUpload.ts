"use client";

import { useCallback, useState } from "react";

import { useEditor } from "@/context/EditorContext";
import { useMediaIngestion } from "@/hooks/useMediaIngestion";
import { probeMediaDuration } from "@/lib/editor/media-utils";
import { mediaAssetsApi, ApiError } from "@/lib/api-client";

export type UploadKind = "media" | "overlay";

const MAX_MEDIA_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_OVERLAY_SIZE_BYTES = 20 * 1024 * 1024;

// Primary media rides the same ingest pipeline as recordings (duration probe,
// ffmpeg.wasm thumbnails/waveform), which only understands playable video —
// unlike the spec's own file-type list, a still image can't become a timeline
// clip here, so images are Overlay-only.
export const MEDIA_ACCEPT = ".mp4,.mov,.webm";
export const OVERLAY_ACCEPT = ".png,.svg,.gif,.webp";
const MEDIA_EXTENSIONS = MEDIA_ACCEPT.split(",");
const OVERLAY_EXTENSIONS = OVERLAY_ACCEPT.split(",");

export interface UploadTask {
  id: string;
  file: File;
  kind: UploadKind;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

interface UseStudioUploadResult {
  tasks: UploadTask[];
  uploadFiles: (files: FileList | File[], kind: UploadKind) => void;
  dismissTask: (id: string) => void;
}

function hasExtension(file: File, extensions: string[]): boolean {
  const name = file.name.toLowerCase();
  return extensions.some((ext) => name.endsWith(ext));
}

function validate(file: File, kind: UploadKind): string | null {
  const maxSize = kind === "media" ? MAX_MEDIA_SIZE_BYTES : MAX_OVERLAY_SIZE_BYTES;
  const extensions = kind === "media" ? MEDIA_EXTENSIONS : OVERLAY_EXTENSIONS;

  if (!hasExtension(file, extensions)) {
    return `Unsupported file type. Accepted: ${extensions.join(", ")}`;
  }
  if (file.size > maxSize) {
    return `File exceeds the ${Math.round(maxSize / (1024 * 1024))}MB limit.`;
  }
  return null;
}

/**
 * Drives the Studio Upload modal: validates each file, hydrates it into the
 * editor immediately from a local object URL (so it's usable before the
 * network call finishes), then uploads it to the workspace's media bin with
 * live progress. A failed backend upload doesn't undo the local ingest — the
 * asset just won't have synced to the server yet.
 */
export function useStudioUpload(): UseStudioUploadResult {
  const { addImageOverlay, updateImageOverlay } = useEditor();
  const { ingest } = useMediaIngestion();
  const [tasks, setTasks] = useState<UploadTask[]>([]);

  const updateTask = useCallback((id: string, changes: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...changes } : task)));
  }, []);

  const uploadOne = useCallback(
    async (file: File, kind: UploadKind, taskId: string) => {
      const src = URL.createObjectURL(file);

      try {
        if (kind === "media") {
          const duration = await probeMediaDuration(src);
          ingest({ src, name: file.name, duration, type: "video" });

          await mediaAssetsApi.upload({
            asset_type: "video",
            title: file.name,
            duration,
            file,
            filename: file.name,
            onProgress: (percent) => updateTask(taskId, { progress: percent }),
          });
        } else {
          const overlayId = addImageOverlay({ src });
          const asset = await mediaAssetsApi.upload({
            asset_type: "overlay",
            title: file.name,
            file,
            filename: file.name,
            onProgress: (percent) => updateTask(taskId, { progress: percent }),
          });
          updateImageOverlay(overlayId, { mediaAssetId: asset.id });
        }
        updateTask(taskId, { status: "success", progress: 100 });
      } catch (error) {
        updateTask(taskId, {
          status: "error",
          error:
            error instanceof ApiError
              ? error.message
              : kind === "media"
                ? "Couldn't read this file — is it a valid video?"
                : "Upload failed — the overlay is still usable locally, but hasn't synced yet.",
        });
      }
    },
    [ingest, addImageOverlay, updateImageOverlay, updateTask],
  );

  const uploadFiles = useCallback(
    (files: FileList | File[], kind: UploadKind) => {
      Array.from(files).forEach((file) => {
        const error = validate(file, kind);
        const taskId = crypto.randomUUID();
        setTasks((prev) => [
          ...prev,
          { id: taskId, file, kind, progress: 0, status: error ? "error" : "uploading", error: error ?? undefined },
        ]);
        if (!error) void uploadOne(file, kind, taskId);
      });
    },
    [uploadOne],
  );

  const dismissTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  return { tasks, uploadFiles, dismissTask };
}
