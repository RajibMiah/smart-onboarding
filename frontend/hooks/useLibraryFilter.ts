"use client";

import { useEffect, useMemo, useState } from "react";

import type { LibrarySortOption, LibraryStatus, LibraryStatusFilter } from "@/types/library";

const SEARCH_DEBOUNCE_MS = 250;

interface UseLibraryFilterOptions<T> {
  items: T[];
  getTitle: (item: T) => string;
  getStatus: (item: T) => LibraryStatus;
  getCreatedAt: (item: T) => string;
  getUpdatedAt: (item: T) => string;
  initialSort?: LibrarySortOption;
  initialStatus?: LibraryStatusFilter;
}

interface UseLibraryFilterResult<T> {
  search: string;
  setSearch: (value: string) => void;
  status: LibraryStatusFilter;
  setStatus: (value: LibraryStatusFilter) => void;
  sort: LibrarySortOption;
  setSort: (value: LibrarySortOption) => void;
  /** True while `search` differs from the debounced value actually applied to `items`. */
  isSearchPending: boolean;
  items: T[];
  totalCount: number;
}

/** Client-side search (debounced), status filtering, and sorting for a library list. */
export function useLibraryFilter<T>({
  items,
  getTitle,
  getStatus,
  getCreatedAt,
  getUpdatedAt,
  initialSort = "updated",
  initialStatus = "all",
}: UseLibraryFilterOptions<T>): UseLibraryFilterResult<T> {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<LibraryStatusFilter>(initialStatus);
  const [sort, setSort] = useState<LibrarySortOption>(initialSort);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const result = items.filter((item) => {
      if (status !== "all" && getStatus(item) !== status) return false;
      if (query && !getTitle(item).toLowerCase().includes(query)) return false;
      return true;
    });

    return result.sort((a, b) => {
      if (sort === "title") return getTitle(a).localeCompare(getTitle(b));
      if (sort === "created") return new Date(getCreatedAt(b)).getTime() - new Date(getCreatedAt(a)).getTime();
      return new Date(getUpdatedAt(b)).getTime() - new Date(getUpdatedAt(a)).getTime();
    });
  }, [items, status, debouncedSearch, sort, getTitle, getStatus, getCreatedAt, getUpdatedAt]);

  return {
    search,
    setSearch,
    status,
    setStatus,
    sort,
    setSort,
    isSearchPending: search !== debouncedSearch,
    items: filtered,
    totalCount: items.length,
  };
}
