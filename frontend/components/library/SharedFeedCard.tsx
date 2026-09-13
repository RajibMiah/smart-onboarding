"use client";

import { useRouter } from "next/navigation";
import { Ban, FileVideo } from "lucide-react";

import { formatRelativeTime } from "@/lib/utils";
import { REQUEST_TYPE_LABELS, SHARE_PERMISSION_LABELS, type SharedFeedItem } from "@/types/sharing";

interface SharedFeedCardProps {
  item: SharedFeedItem;
}

export const SharedFeedCard = ({ item }: SharedFeedCardProps) => {
  const router = useRouter();

  const open = () => {
    if (item.contentType === "clip") router.push(`/studio?clip=${item.objectId}`);
    else router.push(`/library/playlists/${item.objectId}/theater`);
  };

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-3 border border-black bg-white p-3 text-left transition hover:bg-neutral-50"
    >
      <div className="h-16 w-24 shrink-0 overflow-hidden border border-black bg-neutral-100">
        {item.contentThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary thumbnail URL
          <img src={item.contentThumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            {item.contentType === "clip" ? <FileVideo className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-bold text-black">{item.contentTitle || "Untitled"}</p>
        <p className="text-xs text-neutral-500">
          <span className="font-medium text-black">{item.actorName}</span> · {item.targetLabel}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.permission && (
            <span className="border border-black/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-600">
              {SHARE_PERMISSION_LABELS[item.permission]}
            </span>
          )}
          {item.requestType && (
            <span className="border border-black bg-brand-yellow px-1.5 py-0.5 font-mono text-[10px] font-semibold text-black">
              {REQUEST_TYPE_LABELS[item.requestType]}
            </span>
          )}
        </div>
      </div>

      <span className="shrink-0 text-[11px] text-neutral-400" suppressHydrationWarning>
        {formatRelativeTime(item.createdAt)}
      </span>
    </button>
  );
};
