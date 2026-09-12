"use client";

import { useEffect, useMemo, useState } from "react";

import type { Playlist, PlaylistSortOption, PlaylistVisibilityFilter } from "@/types/playlist";

const SEARCH_DEBOUNCE_MS = 250;

interface UsePlaylistFilterOptions {
  playlists: Playlist[];
  initialSort?: PlaylistSortOption;
  initialVisibility?: PlaylistVisibilityFilter;
}

/** Client-side search (debounced), visibility filtering, and sorting for the Playlists library. */
export function usePlaylistFilter({ playlists, initialSort = "updated", initialVisibility = "all" }: UsePlaylistFilterOptions) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibility, setVisibility] = useState<PlaylistVisibilityFilter>(initialVisibility);
  const [sort, setSort] = useState<PlaylistSortOption>(initialSort);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const items = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const result = playlists.filter((playlist) => {
      if (visibility !== "all" && playlist.visibility !== visibility) return false;
      if (query && !playlist.title.toLowerCase().includes(query)) return false;
      return true;
    });

    return result.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "count") return b.clipCount - a.clipCount;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [playlists, visibility, debouncedSearch, sort]);

  return {
    search,
    setSearch,
    visibility,
    setVisibility,
    sort,
    setSort,
    isSearchPending: search !== debouncedSearch,
    items,
    totalCount: playlists.length,
  };
}
