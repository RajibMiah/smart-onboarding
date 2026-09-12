"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import type { Playlist } from "@/types/playlist";

const CREATE_NEW_VALUE = "__create__";

interface PlaylistAssignerProps {
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  error: string | null;
}

/** Mandatory playlist selection — the only gate `handleSaveAndFinish` actually enforces. */
export function PlaylistAssigner({ playlists, selectedPlaylistId, onSelect, onCreate, error }: PlaylistAssignerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  function handleSelectChange(value: string) {
    if (value === CREATE_NEW_VALUE) {
      setIsCreating(true);
      return;
    }
    onSelect(value);
  }

  function handleCreateSubmit() {
    if (!newName.trim()) return;
    onCreate(newName);
    setNewName("");
    setIsCreating(false);
  }

  return (
    <div className={error ? "border border-red-600 p-4" : "border border-black p-4"}>
      <p className="mb-2 text-sm font-semibold text-black">
        Assign to Playlist <span className="text-red-600">*</span>
      </p>

      {isCreating ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleCreateSubmit()}
            placeholder="New playlist name"
            aria-label="New playlist name"
            className="min-w-0 flex-1 border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
          <button
            type="button"
            onClick={handleCreateSubmit}
            aria-label="Create playlist"
            className="shrink-0 border border-black bg-brand-yellow px-3 py-2 text-black transition hover:bg-yellow-500"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <select
          value={selectedPlaylistId ?? ""}
          onChange={(event) => handleSelectChange(event.target.value)}
          aria-label="Assign to playlist"
          aria-invalid={!!error}
          className="w-full border border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
        >
          <option value="" disabled>
            Select a playlist
          </option>
          {playlists.map((playlist) => (
            <option key={playlist.id} value={playlist.id}>
              {playlist.title}
            </option>
          ))}
          <option value={CREATE_NEW_VALUE}>+ Create New Playlist</option>
        </select>
      )}

      {error && (
        <div role="alert" className="mt-2 border border-red-600 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
