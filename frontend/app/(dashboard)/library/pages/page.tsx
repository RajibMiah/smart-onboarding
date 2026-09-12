"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";

import { LibraryEmptyState } from "@/components/library/LibraryEmptyState";
import { PageListItem } from "@/components/library/PageListItem";
import { EditorialFilterBar, type FilterChip } from "@/components/ui/EditorialFilterBar";
import { Toast } from "@/components/ui/Toast";
import { useLibraryFilter } from "@/hooks/useLibraryFilter";
import { useToast } from "@/hooks/useToast";
import { MOCK_PAGES } from "@/lib/library-mock-data";
import { DEFAULT_SORT_OPTIONS, type LibrarySortOption, type LibraryStatusFilter, type PageItem } from "@/types/library";

const STATUS_CHIPS: FilterChip[] = [
  { value: "all", label: "All results" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
];

export default function PagesLibraryPage() {
  const toast = useToast();
  const [pages, setPages] = useState<PageItem[]>(MOCK_PAGES);
  const [view, setView] = useState<"cards" | "table">("cards");

  const filter = useLibraryFilter({
    items: pages,
    getTitle: (page) => page.title,
    getStatus: (page) => page.status,
    getCreatedAt: (page) => page.createdAt,
    getUpdatedAt: (page) => page.updatedAt,
  });

  const removePage = useCallback((id: string) => {
    setPages((prev) => prev.filter((page) => page.id !== id));
  }, []);

  const duplicatePage = useCallback((id: string) => {
    setPages((prev) => {
      const source = prev.find((page) => page.id === id);
      if (!source) return prev;
      const copy: PageItem = {
        ...source,
        id: crypto.randomUUID(),
        title: `${source.title} (copy)`,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        views: 0,
      };
      return [copy, ...prev];
    });
  }, []);

  const renamePage = useCallback((id: string, currentTitle: string) => {
    const next = window.prompt("Rename page", currentTitle)?.trim();
    if (!next) return;
    setPages((prev) => prev.map((page) => (page.id === id ? { ...page, title: next, updatedAt: new Date().toISOString() } : page)));
  }, []);

  const hasAnyPages = pages.length > 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-black">Pages</h1>
        <button
          type="button"
          onClick={() => toast.show("Page editing isn't available in this preview yet.")}
          className="border-2 border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          + New Page
        </button>
      </div>

      <EditorialFilterBar
        chips={STATUS_CHIPS}
        activeChip={filter.status}
        onChipChange={(value) => filter.setStatus(value as LibraryStatusFilter)}
        search={filter.search}
        onSearchChange={filter.setSearch}
        searchPlaceholder="Search for..."
        selects={[
          {
            id: "sort",
            label: "Sort by",
            value: filter.sort,
            options: DEFAULT_SORT_OPTIONS,
            onChange: (value) => filter.setSort(value as LibrarySortOption),
          },
        ]}
        view={view}
        onViewChange={setView}
      />

      <p className="text-xs text-neutral-500">
        Showing {filter.items.length} of {filter.totalCount} pages
      </p>

      {filter.items.length === 0 ? (
        <LibraryEmptyState
          icon={FileText}
          title={hasAnyPages ? "No pages match your search" : "No pages yet"}
          description={
            hasAnyPages
              ? 'Try a different search term or switch the filter to "All results".'
              : "Create a page to start writing documentation for your team."
          }
          actionLabel={hasAnyPages ? undefined : "New Page"}
          onAction={hasAnyPages ? undefined : () => toast.show("Page editing isn't available in this preview yet.")}
        />
      ) : view === "table" ? (
        <LibraryEmptyState title="Table view isn't ready yet" description='Switch back to "Cards" to see your pages.' />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filter.items.map((page) => (
            <PageListItem
              key={page.id}
              page={page}
              onRename={() => renamePage(page.id, page.title)}
              onMoveToProject={() => toast.show("Projects aren't available yet — check back soon.")}
              onDuplicate={() => duplicatePage(page.id)}
              onDelete={() => removePage(page.id)}
            />
          ))}
        </div>
      )}

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
}
