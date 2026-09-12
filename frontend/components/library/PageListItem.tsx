import { FileText } from "lucide-react";

import { EditorialCard } from "@/components/ui/EditorialCard";
import { formatRelativeTime } from "@/lib/utils";
import type { PageItem } from "@/types/library";

import { ItemActionMenu } from "./ItemActionMenu";

interface PageListItemProps {
  page: PageItem;
  onRename?: () => void;
  onMoveToProject?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function PageListItem({ page, onRename, onMoveToProject, onDuplicate, onDelete }: PageListItemProps) {
  return (
    <EditorialCard>
      <EditorialCard.HeaderStrip
        categoryLabel="📄 Guide"
        metricLabel={`${page.sectionCount} section${page.sectionCount === 1 ? "" : "s"}`}
      />

      <div className="flex items-center justify-between border-b border-black/20 p-2">
        <span
          className={
            page.status === "published"
              ? "border border-black bg-brand-yellow px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black"
              : "border border-black bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black"
          }
        >
          {page.status === "published" ? "Published" : "Draft"}
        </span>
        <ItemActionMenu
          itemLabel={page.title}
          onRename={onRename}
          onMoveToProject={onMoveToProject}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>

      <EditorialCard.Body
        title={page.title}
        metaLine={`${page.views} views · Updated ${formatRelativeTime(page.updatedAt)}`}
        thumbnail={
          <div className="flex h-20 items-center justify-center bg-neutral-50">
            <FileText className="h-8 w-8 text-black" />
          </div>
        }
      />

      <EditorialCard.Footer label="▲ Open This Page" counter={page.views} />
    </EditorialCard>
  );
}
