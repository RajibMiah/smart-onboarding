"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";

import { ClipListItem } from "@/components/library/ClipListItem";
import { LibraryEmptyState } from "@/components/library/LibraryEmptyState";
import { EditorialFilterBar, type FilterChip } from "@/components/ui/EditorialFilterBar";
import { Toast } from "@/components/ui/Toast";
import { useLibraryFilter } from "@/hooks/useLibraryFilter";
import { useToast } from "@/hooks/useToast";
import {
  duplicateClipInStore,
  getClipsSnapshot,
  removeClipFromStore,
  renameClipInStore,
  subscribeToClips,
} from "@/lib/library-mock-data";
import { DEFAULT_SORT_OPTIONS, type LibrarySortOption, type LibraryStatusFilter } from "@/types/library";

const STATUS_CHIPS: FilterChip[] = [
  { value: "all", label: "All results" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
];

export default function ClipsLibraryPage() {
  const router = useRouter();
  const toast = useToast();
  const clips = useSyncExternalStore(subscribeToClips, getClipsSnapshot, getClipsSnapshot);
  const [view, setView] = useState<"cards" | "table">("cards");

  const filter = useLibraryFilter({
    items: clips,
    getTitle: (clip) => clip.title,
    getStatus: (clip) => clip.status,
    getCreatedAt: (clip) => clip.createdAt,
    getUpdatedAt: (clip) => clip.updatedAt,
  });

  const removeClip = useCallback((id: string) => removeClipFromStore(id), []);
  const duplicateClip = useCallback((id: string) => duplicateClipInStore(id), []);

  const renameClip = useCallback((id: string, currentTitle: string) => {
    const next = window.prompt("Rename clip", currentTitle)?.trim();
    if (!next) return;
    renameClipInStore(id, next);
  }, []);

  const hasAnyClips = clips.length > 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-black">Clips</h1>
        <button
          type="button"
          onClick={() => router.push("/studio")}
          className="border-2 border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          + New Clip
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
        Showing {filter.items.length} of {filter.totalCount} clips
      </p>

      {filter.items.length === 0 ? (
        <LibraryEmptyState
          icon={Video}
          title={hasAnyClips ? "No clips match your search" : "No clips yet"}
          description={
            hasAnyClips
              ? 'Try a different search term or switch the filter to "All results".'
              : "Record a screen capture or camera clip to see it appear here."
          }
          actionLabel={hasAnyClips ? undefined : "Record a clip"}
          onAction={hasAnyClips ? undefined : () => router.push("/studio")}
        />
      ) : view === "table" ? (
        <LibraryEmptyState title="Table view isn't ready yet" description='Switch back to "Cards" to see your clips.' />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filter.items.map((clip) => (
            <ClipListItem
              key={clip.id}
              clip={clip}
              onRename={() => renameClip(clip.id, clip.title)}
              onMoveToProject={() => toast.show("Projects aren't available yet — check back soon.")}
              onDuplicate={() => duplicateClip(clip.id)}
              onDelete={() => removeClip(clip.id)}
            />
          ))}
        </div>
      )}

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
}
