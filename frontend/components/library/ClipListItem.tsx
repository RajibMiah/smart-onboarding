"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Copy, FolderInput, Image as ImageIcon, Pencil, Share2, Trash2 } from "lucide-react";

import { EditorialCard } from "@/components/ui/EditorialCard";
import type { ClipVisibility } from "@/lib/api-client";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import type { ClipItem } from "@/types/library";

import { ItemActionMenu } from "./ItemActionMenu";

const VISIBILITY_OPTIONS: { value: ClipVisibility; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "private", label: "Private" },
  { value: "published", label: "Public" },
];

interface ClipListItemProps {
  clip: ClipItem;
  onRename?: () => void;
  onMoveToProject?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onVisibilityChange?: (visibility: ClipVisibility) => void;
  onThumbnailChange?: (file: File) => void;
}

export const ClipListItem = ({
  clip,
  onRename,
  onMoveToProject,
  onDuplicate,
  onDelete,
  onShare,
  onVisibilityChange,
  onThumbnailChange,
}: ClipListItemProps) => {
  const router = useRouter();
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Tracks the specific URL that failed rather than a plain boolean, so a
  // later thumbnail change (a new URL) naturally clears the failed state on
  // its own — no effect/reset needed. A failed thumbnail (wrong/expired URL,
  // deleted file, unreachable host) previously left a bare broken-image icon
  // on the card forever instead of falling back like the "no thumbnail yet" case.
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string | undefined>(undefined);
  const thumbnailHasError = clip.thumbnailUrl !== undefined && clip.thumbnailUrl === failedThumbnailUrl;

  // Every clip that reaches this list is already something the viewer may
  // see (backend scoping) — clicking the card always opens the read-only
  // Watch page, whether or not they can edit. Editing is now a distinct,
  // explicit action (the menu's "Edit in Studio" item), not the card's
  // default click target — a view-only recipient of a shared clip
  // previously had nowhere to open it at all.
  const navigate = () => {
    router.push(`/library/clips/${clip.id}/watch`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={navigate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate();
        }
      }}
      className="cursor-pointer rounded-none transition hover:bg-neutral-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
    >
      <EditorialCard>
        <EditorialCard.HeaderStrip categoryLabel="🎥 Clip" metricLabel={formatDuration(clip.durationSeconds)} />

        <div className="flex items-center justify-between border-b border-black/20 p-2">
          {clip.isOwner ? (
            <div className="relative" onClick={(event) => event.stopPropagation()}>
              <select
                value={clip.visibility}
                onChange={(event) => onVisibilityChange?.(event.target.value as ClipVisibility)}
                aria-label="Clip visibility"
                className="appearance-none border border-black bg-white py-0.5 pl-2 pr-6 text-[11px] font-semibold uppercase tracking-wide text-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span
              className={
                clip.status === "published"
                  ? "border border-black bg-brand-yellow px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black"
                  : "border border-black bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black"
              }
            >
              {clip.visibility === "published" ? "Public" : clip.visibility === "private" ? "Private" : "Draft"}
            </span>
          )}

          <div onClick={(event) => event.stopPropagation()}>
            <ItemActionMenu
              itemLabel={clip.title}
              items={[
                ...(clip.canEdit
                  ? [
                      { icon: Clapperboard, label: "Edit in Studio", onClick: () => router.push(`/studio?clip=${clip.id}`) },
                      { icon: Pencil, label: "Rename", onClick: onRename },
                      { icon: ImageIcon, label: "Set Thumbnail", onClick: () => thumbnailInputRef.current?.click() },
                      { icon: FolderInput, label: "Move to Project", onClick: onMoveToProject },
                    ]
                  : []),
                { icon: Share2, label: "Share & Request", onClick: onShare },
                { icon: Copy, label: "Duplicate", onClick: onDuplicate },
                ...(clip.isOwner
                  ? [{ icon: Trash2, label: "Delete", tone: "danger" as const, onClick: onDelete, dividerBefore: true }]
                  : []),
              ]}
            />
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onThumbnailChange?.(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>

        <EditorialCard.Body
          title={clip.title}
          metaLine={`Updated ${formatRelativeTime(clip.updatedAt)}`}
          description={`${clip.views} views · ${clip.likes} likes · ${clip.comments} comments`}
          thumbnail={
            clip.thumbnailUrl && !thumbnailHasError ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary/object-URL thumbnails
              <img
                src={clip.thumbnailUrl}
                alt=""
                onError={() => setFailedThumbnailUrl(clip.thumbnailUrl)}
                className="h-28 w-full object-cover"
              />
            ) : clip.videoUrl ? (
              // No thumbnail set yet — fall back to the video's own first
              // frame instead of a blank placeholder. `#t=0.1` asks the
              // browser to decode a moment just past frame 0 as its poster,
              // since some codecs render frame 0 itself as solid black.
              <video
                src={`${clip.videoUrl}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                // "use-credentials", not "anonymous" — this points at the
                // same cookie-authenticated video-asset endpoint as the real
                // player; "anonymous" strips the auth cookie from the
                // request and the poster frame 404s for anyone, even the owner.
                crossOrigin="use-credentials"
                className="h-28 w-full object-cover"
              />
            ) : (
              <EditorialCard.HatchPlaceholder className="h-28" />
            )
          }
        />

        <EditorialCard.Footer label="▲ Watch Clip" counter={clip.views} />
      </EditorialCard>
    </div>
  );
};
