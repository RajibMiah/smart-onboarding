"use client";

import { Share2 } from "lucide-react";

import { SharedFeedCard } from "@/components/library/SharedFeedCard";
import { useSharedFeed } from "@/hooks/useSharedFeed";

const SharedByMePage = () => {
  const { items, isLoading, error } = useSharedFeed("by_me");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight text-black">Shared by me</h1>

      {error && (
        <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && items.length === 0 ? (
        <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-dashed border-black/30 bg-white p-16 text-center">
          <Share2 className="mx-auto h-8 w-8 text-neutral-400" />
          <h2 className="mt-3 text-lg font-bold text-black">Shared by me</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Clips and playlists you share or send a request on will show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <SharedFeedCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
export default SharedByMePage;
