"use client";

import { ChevronLeft, ChevronRight, FileText, ListVideo, MessageCircleQuestion, Play } from "lucide-react";

import { EditorialCard } from "@/components/ui/EditorialCard";
import { useCarousel } from "@/hooks/useCarousel";
import { CONTINUING_ITEMS } from "@/lib/mock-data";
import type { ContinuingItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const DECK_ITEM_CLASSES = "w-72 shrink-0 snap-start";

export function ContinueEditingDeck() {
  const { scrollRef, scrollPrev, scrollNext, canScrollPrev, canScrollNext } = useCarousel();

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
        {CONTINUING_ITEMS.map((item) => (
          <div key={item.id} className={DECK_ITEM_CLASSES}>
            <ContinuingItemCard item={item} />
          </div>
        ))}
        <div className={DECK_ITEM_CLASSES}>
          <RequestsCalloutCard />
        </div>
      </div>
    </section>
  );
}

function DeckNavButton({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}) {
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
}

function ContinuingItemCard({ item }: { item: ContinuingItem }) {
  if (item.kind === "video") return <VideoCard item={item} />;
  if (item.kind === "playlist") return <PlaylistStackCard item={item} />;
  return <PageCard item={item} />;
}

function VideoCard({ item }: { item: ContinuingItem }) {
  return (
    <EditorialCard>
      <EditorialCard.HeaderStrip categoryLabel="🎥 Recording" metricLabel={item.durationLabel} />
      <EditorialCard.Body
        title={item.title}
        metaLine={item.meta}
        thumbnail={
          <div className={cn("flex h-28 items-center justify-center bg-gradient-to-br", item.thumbnailGradient)}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-black">
              <Play className="h-4 w-4 translate-x-px fill-current" />
            </span>
          </div>
        }
      />
      <EditorialCard.Footer label="▲ Open in Studio" />
    </EditorialCard>
  );
}

function PageCard({ item }: { item: ContinuingItem }) {
  return (
    <EditorialCard>
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
      <EditorialCard.Footer label="▲ Open Page" />
    </EditorialCard>
  );
}

function PlaylistStackCard({ item }: { item: ContinuingItem }) {
  return (
    <EditorialCard>
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
      <EditorialCard.Footer label="▲ Open Playlist" />
    </EditorialCard>
  );
}

function RequestsCalloutCard() {
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
}
