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

export function ClipListItem({ clip, onRename, onMoveToProject, onDuplicate, onDelete }: ClipListItemProps) {
  return (
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
        <ItemActionMenu
          itemLabel={clip.title}
          onRename={onRename}
          onMoveToProject={onMoveToProject}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
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

      <EditorialCard.Footer label="▲ Edit This Clip" counter={clip.views} href={`/studio?clip=${clip.id}`} />
    </EditorialCard>
  );
}
