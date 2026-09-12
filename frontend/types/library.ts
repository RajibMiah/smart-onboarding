/** Data models and query types shared by the My Library section (clips & pages). */

export type LibraryStatus = "draft" | "published";

export interface ClipItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  status: LibraryStatus;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  views: number;
  likes: number;
  comments: number;
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
