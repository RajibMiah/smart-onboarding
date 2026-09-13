"use client";

import { useRouter } from "next/navigation";
import { Copy, FolderInput, Pencil, Trash2 } from "lucide-react";

import { EditorialCard } from "@/components/ui/EditorialCard";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import type { ClipItem } from "@/types/library";

import { ItemActionMenu } from "./ItemActionMenu";

interface ClipListItemProps {
  clip: ClipItem;
  onRename?: () => void;
  onMoveToProject?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export const ClipListItem = ({ clip, onRename, onMoveToProject, onDuplicate, onDelete }: ClipListItemProps) => {
  const router = useRouter();
  const href = `/studio?clip=${clip.id}`;

  const navigate = () => {
    router.push(href);
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
          <span
            className={
              clip.status === "published"
                ? "border border-black bg-brand-yellow px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black"
                : "border border-black bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black"
            }
          >
            {clip.status === "published" ? "Published" : "Draft"}
          </span>
          <div onClick={(event) => event.stopPropagation()}>
            <ItemActionMenu
              itemLabel={clip.title}
              items={[
                { icon: Pencil, label: "Rename", onClick: onRename },
                { icon: FolderInput, label: "Move to Project", onClick: onMoveToProject },
                { icon: Copy, label: "Duplicate", onClick: onDuplicate },
                { icon: Trash2, label: "Delete", tone: "danger", onClick: onDelete, dividerBefore: true },
              ]}
            />
          </div>
        </div>

        <EditorialCard.Body
          title={clip.title}
          metaLine={`Updated ${formatRelativeTime(clip.updatedAt)}`}
          description={`${clip.views} views · ${clip.likes} likes · ${clip.comments} comments`}
          thumbnail={
            clip.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary/object-URL thumbnails
              <img src={clip.thumbnailUrl} alt="" className="h-28 w-full object-cover" />
            ) : (
              <EditorialCard.HatchPlaceholder className="h-28" />
            )
          }
        />

        <EditorialCard.Footer label="▲ Edit This Clip" counter={clip.views} />
      </EditorialCard>
    </div>
  );
};
