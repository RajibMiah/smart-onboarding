"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";

import { LibraryEmptyState } from "@/components/library/LibraryEmptyState";
import { PageListItem } from "@/components/library/PageListItem";
import { EditorialFilterBar, type FilterChip } from "@/components/ui/EditorialFilterBar";
import { Toast } from "@/components/ui/Toast";
import { usePages } from "@/hooks/usePages";
import { useLibraryFilter } from "@/hooks/useLibraryFilter";
import { useToast } from "@/hooks/useToast";
import { DEFAULT_SORT_OPTIONS, type LibrarySortOption, type LibraryStatusFilter } from "@/types/library";

const STATUS_CHIPS: FilterChip[] = [
  { value: "all", label: "All results" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
];

const PagesLibraryPage = () => {
  const toast = useToast();
  const { pages, isLoading, error, createPage, removePage, duplicatePage, renamePage } = usePages();
  const [view, setView] = useState<"cards" | "table">("cards");

  const filter = useLibraryFilter({
    items: pages,
    getTitle: (page) => page.title,
    getStatus: (page) => page.status,
    getCreatedAt: (page) => page.createdAt,
    getUpdatedAt: (page) => page.updatedAt,
  });

  const handleCreate = useCallback(async () => {
    const title = window.prompt("New page title", "Untitled page")?.trim();
    if (!title) return;
    try {
      await createPage(title);
    } catch {
      toast.show("Couldn't create the page — try again.");
    }
  }, [createPage, toast]);

  const handleRename = useCallback(
    (id: string, currentTitle: string) => {
      const next = window.prompt("Rename page", currentTitle)?.trim();
      if (!next) return;
      void renamePage(id, next);
    },
    [renamePage],
  );

  const hasAnyPages = pages.length > 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-black">Pages</h1>
        <button
          type="button"
          onClick={() => void handleCreate()}
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
        {isLoading ? "Loading pages…" : `Showing ${filter.items.length} of ${filter.totalCount} pages`}
      </p>

      {error && (
        <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && filter.items.length === 0 ? (
        <LibraryEmptyState
          icon={FileText}
          title={hasAnyPages ? "No pages match your search" : "No pages yet"}
          description={
            hasAnyPages
              ? 'Try a different search term or switch the filter to "All results".'
              : "Create a page to start writing documentation for your team."
          }
          actionLabel={hasAnyPages ? undefined : "New Page"}
          onAction={hasAnyPages ? undefined : () => void handleCreate()}
        />
      ) : view === "table" ? (
        <LibraryEmptyState title="Table view isn't ready yet" description='Switch back to "Cards" to see your pages.' />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filter.items.map((page) => (
            <PageListItem
              key={page.id}
              page={page}
              onOpen={() => toast.show("Page editing isn't available in this preview yet.")}
              onRename={() => handleRename(page.id, page.title)}
              onMoveToProject={() => toast.show("Projects aren't available yet — check back soon.")}
              onDuplicate={() => void duplicatePage(page.id)}
              onDelete={() => void removePage(page.id)}
            />
          ))}
        </div>
      )}

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};
export default PagesLibraryPage;
