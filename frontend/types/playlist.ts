export type PlaylistVisibility = "public" | "private";

/** Distinct from `PlaylistVisibility` — "all" is a filter value, not a state a playlist can be in. */
export type PlaylistVisibilityFilter = "all" | PlaylistVisibility;

export type PlaylistSortOption = "updated" | "created" | "title" | "count";

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  clipCount: number;
  thumbnailUrl?: string | null;
  visibility: PlaylistVisibility;
  updatedAt: string;
  createdAt: string;
  clipIds: string[];
}

export const PLAYLIST_SORT_OPTIONS: { value: PlaylistSortOption; label: string }[] = [
  { value: "updated", label: "Last edited" },
  { value: "created", label: "Created date" },
  { value: "title", label: "Title A-Z" },
  { value: "count", label: "Video count" },
];

export const PLAYLIST_VISIBILITY_OPTIONS: { value: PlaylistVisibilityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
];
