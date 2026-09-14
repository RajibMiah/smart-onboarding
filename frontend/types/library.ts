/** Data models and query types shared by the My Library section (clips & pages). */

import type { ClipVisibility } from "@/lib/api-client";

export type LibraryStatus = "draft" | "published";

export interface ClipItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  /** The clip's own video asset URL — used as a live "first frame" preview
   *  on the card when no thumbnail has been set. */
  videoUrl?: string;
  durationSeconds: number;
  status: LibraryStatus;
  visibility: ClipVisibility;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  views: number;
  likes: number;
  comments: number;
  /** May edit this clip's content — not by itself changing visibility or
   *  deleting it, see `isOwner`. */
  canEdit: boolean;
  /** This clip's own creator or a global admin. Gates changing visibility and deleting. */
  isOwner: boolean;
  /** Distinct playlists this clip currently belongs to. */
  playlistCount: number;
}

export interface PageItem {
  id: string;
  title: string;
  status: LibraryStatus;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  views: number;
  sectionCount: number;
}

export type LibrarySortOption = "updated" | "created" | "title";

/** Distinct from `LibraryStatus` — "all" isn't a state an item can be in, only a filter value. */
export type LibraryStatusFilter = "all" | LibraryStatus;

export interface LibraryFilterQuery {
  search: string;
  status: LibraryStatusFilter;
  sort: LibrarySortOption;
}

export interface SortOption {
  value: LibrarySortOption;
  label: string;
}

export interface StatusFilterOption {
  value: LibraryStatusFilter;
  label: string;
}

export const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { value: "updated", label: "Last edited" },
  { value: "created", label: "Created date" },
  { value: "title", label: "Title A-Z" },
];
