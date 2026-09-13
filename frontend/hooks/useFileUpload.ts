"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatBytes } from "@/lib/utils";
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  MAX_UPLOAD_SIZE_BYTES,
  type UploadItem,
} from "@/lib/types";

interface UseFileUploadOptions {
  acceptedExtensions?: readonly string[];
  maxSizeBytes?: number;
}

interface UseFileUploadResult {
  items: UploadItem[];
  addFiles: (files: FileList | File[]) => void;
  removeItem: (id: string) => void;
  cancelItem: (id: string) => void;
  retryItem: (id: string) => void;
  clearAll: () => void;
}

/**
 * Manages a list of in-flight uploads with client-side validation and a
 * simulated progress lifecycle (no real network call — this is the frontend
 * scaffold; wiring to the backend upload endpoint lands in a later phase).
 */
export const useFileUpload = (options: UseFileUploadOptions = {}): UseFileUploadResult => {
  const {
    acceptedExtensions = ACCEPTED_UPLOAD_EXTENSIONS,
    maxSizeBytes = MAX_UPLOAD_SIZE_BYTES,
  } = options;

  const [items, setItems] = useState<UploadItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setInterval>>());

  const clearTimer = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearInterval(timer);
      timers.current.delete(id);
    }
  }, []);

  // Stop every simulated upload if the component unmounts mid-flight.
  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      timerMap.forEach((timer) => clearInterval(timer));
      timerMap.clear();
    };
  }, []);

  const validate = useCallback(
    (file: File): string | null => {
      const hasValidExtension = acceptedExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      );
      if (!hasValidExtension) {
        return `Unsupported file type. Accepted: ${acceptedExtensions.join(", ")}`;
      }
      if (file.size > maxSizeBytes) {
        return `File exceeds the ${formatBytes(maxSizeBytes)} limit.`;
      }
      return null;
    },
    [acceptedExtensions, maxSizeBytes],
  );

  const runSimulatedUpload = useCallback(
    (id: string) => {
      const interval = setInterval(() => {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id || item.status !== "uploading") return item;
            const next = Math.min(100, item.progress + Math.random() * 18 + 6);
            if (next >= 100) {
              clearTimer(id);
              return { ...item, progress: 100, status: "success" };
            }
            return { ...item, progress: next };
          }),
        );
      }, 220);
      timers.current.set(id, interval);
    },
    [clearTimer],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming: UploadItem[] = Array.from(fileList).map((file) => {
        const error = validate(file);
        return {
          id: crypto.randomUUID(),
          file,
          progress: 0,
          status: error ? "error" : "uploading",
          error: error ?? undefined,
        };
      });

      setItems((prev) => [...prev, ...incoming]);
      incoming
        .filter((item) => item.status === "uploading")
        .forEach((item) => runSimulatedUpload(item.id));
    },
    [validate, runSimulatedUpload],
  );

  const cancelItem = useCallback(
    (id: string) => {
      clearTimer(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id && item.status === "uploading"
            ? { ...item, status: "cancelled" }
            : item,
        ),
      );
    },
    [clearTimer],
  );

  const retryItem = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "uploading", progress: 0, error: undefined } : item,
        ),
      );
      runSimulatedUpload(id);
    },
    [runSimulatedUpload],
  );

  const removeItem = useCallback(
    (id: string) => {
      clearTimer(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [clearTimer],
  );

  const clearAll = useCallback(() => {
    timers.current.forEach((timer) => clearInterval(timer));
    timers.current.clear();
    setItems([]);
  }, []);

  return { items, addFiles, removeItem, cancelItem, retryItem, clearAll };
};
