"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";
import { useModal } from "@/hooks/useModal";
import { cn } from "@/lib/utils";
import type { PlaylistVisibility } from "@/types/playlist";

export const NEW_PLAYLIST_MODAL_ID = "new-playlist";

interface NewPlaylistModalProps {
  onCreate: (input: { title: string; description: string; visibility: PlaylistVisibility }) => void;
}

function NewPlaylistModalImpl({ onCreate }: NewPlaylistModalProps) {
  const { isOpen, close } = useModal(NEW_PLAYLIST_MODAL_ID);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<PlaylistVisibility>("private");

  if (!isOpen) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim(), description: description.trim(), visibility });
    setTitle("");
    setDescription("");
    setVisibility("private");
    close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" onClick={close} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-playlist-title"
        className="relative w-full max-w-md border-2 border-black bg-white shadow-popover animate-modal-in"
      >
        <div className="flex items-center justify-between border-b-2 border-black px-5 py-3">
          <h2 id="new-playlist-title" className="text-base font-bold text-black">
            New Playlist
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="p-1 text-black transition hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div>
            <label htmlFor="new-playlist-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Name
            </label>
            <input
              id="new-playlist-name"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Onboarding 2026"
              className="w-full border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label
              htmlFor="new-playlist-description"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              Description
            </label>
            <textarea
              id="new-playlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What's this playlist for?"
              className="w-full resize-none border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <fieldset>
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Visibility</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["public", "private"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVisibility(option)}
                  aria-pressed={visibility === option}
                  className={cn(
                    "border-2 py-2 text-sm font-semibold capitalize transition",
                    visibility === option ? "border-black bg-brand-yellow text-black" : "border-black/20 text-neutral-600 hover:border-black",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full bg-black py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            Create Playlist
          </button>
        </form>
      </div>
    </div>
  );
}

export const NewPlaylistModal = withPortal(NewPlaylistModalImpl);
