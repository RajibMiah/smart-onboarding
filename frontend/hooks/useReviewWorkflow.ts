"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { addClip } from "@/lib/library-mock-data";
import type { ClipItem } from "@/types/library";
import type { DocumentationStep, PlaylistOption, ProcessingStatus } from "@/types/review";

const DEFAULT_PLAYLISTS: PlaylistOption[] = [
  { id: "onboarding-2026", name: "Onboarding 2026" },
  { id: "product-tutorials", name: "Product Tutorials" },
  { id: "engineering-guides", name: "Engineering Guides" },
];

/** Simulated processing delay — there's no real transcoding backend yet. */
const PROCESSING_DURATION_MS = 3000;

interface UseReviewWorkflowOptions {
  initialTitle: string;
  /** Whether there's actually a clip to review — drives processing vs. the empty state. */
  hasMedia: boolean;
}

/** Owns the whole Review & Publish page's state, per `types/review.ts`. */
export function useReviewWorkflow({ initialTitle, hasMedia }: UseReviewWorkflowOptions) {
  const router = useRouter();

  const [projectTitle, setProjectTitle] = useState(initialTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  // "error" (no media) is derived at render time below rather than stored —
  // only the processing->ready transition needs state, since it's driven by
  // a timer rather than something computable from props on every render.
  const [timedStatus, setTimedStatus] = useState<"processing" | "ready">("processing");
  const [isPublished, setIsPublished] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>(DEFAULT_PLAYLISTS);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<DocumentationStep[]>([]);

  const processingStatus: ProcessingStatus = hasMedia ? timedStatus : "error";

  useEffect(() => {
    // Initial state is already "processing" — this only needs to schedule
    // the transition to "ready", not set the starting value.
    if (!hasMedia) return;
    const timer = setTimeout(() => setTimedStatus("ready"), PROCESSING_DURATION_MS);
    return () => clearTimeout(timer);
  }, [hasMedia]);

  const startEditingTitle = useCallback(() => setIsEditingTitle(true), []);
  const commitTitle = useCallback((next: string) => {
    setProjectTitle((prev) => next.trim() || prev);
    setIsEditingTitle(false);
  }, []);

  const selectPlaylist = useCallback((id: string) => {
    setSelectedPlaylistId(id);
    setPlaylistError(null);
  }, []);

  const createPlaylist = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = crypto.randomUUID();
    setPlaylists((prev) => [...prev, { id, name: trimmed }]);
    setSelectedPlaylistId(id);
    setPlaylistError(null);
  }, []);

  const addStep = useCallback((timestamp: number) => {
    setSteps((prev) => [...prev, { id: crypto.randomUUID(), timestamp, title: "", content: "" }]);
  }, []);

  const updateStep = useCallback((id: string, changes: Partial<Omit<DocumentationStep, "id">>) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, ...changes } : step)));
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
  }, []);

  const handleSaveAndFinish = useCallback(
    (durationSeconds: number) => {
      if (!selectedPlaylistId) {
        setPlaylistError("Select or create a playlist before finishing.");
        return;
      }
      const clip: ClipItem = {
        id: crypto.randomUUID(),
        title: projectTitle,
        durationSeconds: Math.round(durationSeconds),
        status: isPublished ? "published" : "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        views: 0,
        likes: 0,
        comments: 0,
      };
      addClip(clip);
      router.push("/library/clips");
    },
    [selectedPlaylistId, projectTitle, isPublished, router],
  );

  return {
    projectTitle,
    isEditingTitle,
    startEditingTitle,
    commitTitle,
    processingStatus,
    isPublished,
    setIsPublished,
    playlists,
    selectedPlaylistId,
    selectPlaylist,
    createPlaylist,
    playlistError,
    description,
    setDescription,
    steps,
    addStep,
    updateStep,
    removeStep,
    handleSaveAndFinish,
  };
}
