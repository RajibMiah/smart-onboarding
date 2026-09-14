"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, FileText, ListVideo, MessageCircleQuestion, Play } from "lucide-react";

import { EditorialCard } from "@/components/ui/EditorialCard";
import { Toast } from "@/components/ui/Toast";
import { useCarousel } from "@/hooks/useCarousel";
import { useClips } from "@/hooks/useClips";
import { usePages } from "@/hooks/usePages";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useToast } from "@/hooks/useToast";
import type { ContinuingItem } from "@/lib/types";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";

const DECK_ITEM_CLASSES = "w-72 shrink-0 snap-start";
const MAX_ITEMS = 4;
const THUMBNAIL_GRADIENT = "from-slate-700 via-slate-800 to-slate-900";

export const ContinueEditingDeck = () => {
  const { scrollRef, scrollPrev, scrollNext, canScrollPrev, canScrollNext } = useCarousel();
  const toast = useToast();
  const { clips } = useClips();
  const { pages } = usePages();
  const { playlists } = usePlaylists();

  const items = useMemo<ContinuingItem[]>(() => {
    const videos = clips.map((clip) => ({
      updatedAt: clip.updatedAt,
      item: {
        id: clip.id,
        kind: "video" as const,
        title: clip.title,
        meta: `${clip.views} views · Updated ${formatRelativeTime(clip.updatedAt)}`,
        durationLabel: formatDuration(clip.durationSeconds),
        thumbnailGradient: THUMBNAIL_GRADIENT,
        thumbnailUrl: clip.thumbnailUrl,
      },
    }));
    const pageItems = pages.map((page) => ({
      updatedAt: page.updatedAt,
      item: {
        id: page.id,
        kind: "page" as const,
        title: page.title,
        meta: `${page.views} views · Updated ${formatRelativeTime(page.updatedAt)}`,
      },
    }));
    const playlistItems = playlists.map((playlist) => ({
      updatedAt: playlist.updatedAt,
      item: {
        id: playlist.id,
        kind: "playlist" as const,
        title: playlist.title,
        meta: `Updated ${formatRelativeTime(playlist.updatedAt)}`,
        itemCount: playlist.clipCount,
      },
    }));

    return [...videos, ...pageItems, ...playlistItems]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_ITEMS)
      .map((entry) => entry.item);
  }, [clips, pages, playlists]);

  return (
    <section aria-labelledby="continue-editing-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="continue-editing-heading" className="flex items-center gap-2 text-base font-bold text-black">
          <ListVideo className="h-[18px] w-[18px]" aria-hidden="true" />
          Continue editing
        </h2>
        <div className="flex items-center gap-1.5">
          <DeckNavButton direction="prev" onClick={scrollPrev} disabled={!canScrollPrev} />
          <DeckNavButton direction="next" onClick={scrollNext} disabled={!canScrollNext} />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 scrollbar-hide"
      >
        {items.map((item) => (
          <div key={`${item.kind}-${item.id}`} className={DECK_ITEM_CLASSES}>
            <ContinuingItemCard item={item} onOpenPage={() => toast.show("Page editing isn't available in this preview yet.")} />
          </div>
        ))}
        <div className={DECK_ITEM_CLASSES}>
          <RequestsCalloutCard />
        </div>
      </div>
      {toast.message && <Toast message={toast.message} />}
    </section>
  );
};

const DeckNavButton = ({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}) => {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Scroll left" : "Scroll right"}
      className="border-2 border-black p-1.5 text-black transition hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
};

const ContinuingItemCard = ({ item, onOpenPage }: { item: ContinuingItem; onOpenPage: () => void }) => {
  if (item.kind === "video") return <VideoCard item={item} />;
  if (item.kind === "playlist") return <PlaylistStackCard item={item} />;
  return <PageCard item={item} onOpenPage={onOpenPage} />;
};

const VideoCard = ({ item }: { item: ContinuingItem }) => {
  return (
    <EditorialCard className="cursor-pointer transition-transform duration-150 hover:-translate-y-0.5">
      <EditorialCard.HeaderStrip categoryLabel="🎥 Recording" metricLabel={item.durationLabel} />
      <EditorialCard.Body
        title={item.title}
        metaLine={item.meta}
        thumbnail={
          item.thumbnailUrl ? (
            <div className="relative h-28 w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- backend-served thumbnail, arbitrary origin */}
              <img src={item.thumbnailUrl} alt="" crossOrigin="anonymous" className="h-28 w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-black">
                  <Play className="h-4 w-4 translate-x-px fill-current" />
                </span>
              </span>
            </div>
          ) : (
            <div className={cn("flex h-28 items-center justify-center bg-gradient-to-br", item.thumbnailGradient)}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-black">
                <Play className="h-4 w-4 translate-x-px fill-current" />
              </span>
            </div>
          )
        }
      />
      <EditorialCard.Footer label="▲ Watch Clip" href={`/library/clips/${item.id}/watch`} />
    </EditorialCard>
  );
};

const PageCard = ({ item, onOpenPage }: { item: ContinuingItem; onOpenPage: () => void }) => {
  return (
    <EditorialCard className="cursor-pointer transition-transform duration-150 hover:-translate-y-0.5">
      <EditorialCard.HeaderStrip categoryLabel="📄 Page" />
      {item.starred && <EditorialCard.TagRow tags={[{ label: "Starred", tone: "yellow" }]} />}
      <EditorialCard.Body
        title={item.title}
        metaLine={item.meta}
        thumbnail={
          <div className="flex h-28 flex-col justify-center gap-1.5 bg-neutral-50 px-4">
            <FileText className="h-5 w-5 text-black" />
            <div className="h-1.5 w-2/3 bg-neutral-300" />
            <div className="h-1.5 w-1/2 bg-neutral-300" />
          </div>
        }
      />
      <EditorialCard.Footer label="▲ Open Page" onClick={onOpenPage} />
    </EditorialCard>
  );
};

const PlaylistStackCard = ({ item }: { item: ContinuingItem }) => {
  return (
    <EditorialCard className="cursor-pointer transition-transform duration-150 hover:-translate-y-0.5">
      <EditorialCard.HeaderStrip categoryLabel="📑 Playlist" metricLabel={`${item.itemCount ?? 0} clip(s)`} />
      {item.starred && <EditorialCard.TagRow tags={[{ label: "Starred", tone: "yellow" }]} />}
      <EditorialCard.Body
        title={item.title}
        metaLine={item.meta}
        thumbnail={
          <div className="flex h-28 items-center justify-center bg-neutral-900">
            <ListVideo className="h-7 w-7 text-white" />
          </div>
        }
      />
      <EditorialCard.Footer label="▲ Open Playlist" href={`/library/playlists/${item.id}/theater`} />
    </EditorialCard>
  );
};

const RequestsCalloutCard = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 border-2 border-dashed border-black p-5 text-center">
      <MessageCircleQuestion className="h-6 w-6 text-black" />
      <p className="font-bold text-black">Requests</p>
      <p className="text-sm text-neutral-600">You have 0 open requests</p>
      <button
        type="button"
        className="mt-1 border-2 border-black bg-white px-3.5 py-1.5 text-sm font-semibold text-black transition hover:bg-neutral-100"
      >
        See requests
      </button>
    </div>
  );
};
