"use client";

import { Copy, FileText, FolderInput, Pencil, Trash2 } from "lucide-react";

import { EditorialCard } from "@/components/ui/EditorialCard";
import { formatRelativeTime } from "@/lib/utils";
import type { PageItem } from "@/types/library";

import { ItemActionMenu } from "./ItemActionMenu";

interface PageListItemProps {
  page: PageItem;
  onOpen?: () => void;
  onRename?: () => void;
  onMoveToProject?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function PageListItem({ page, onOpen, onRename, onMoveToProject, onDuplicate, onDelete }: PageListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.();
        }
      }}
      className="cursor-pointer rounded-none transition hover:bg-neutral-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
    >
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
          <div onClick={(event) => event.stopPropagation()}>
            <ItemActionMenu
              itemLabel={page.title}
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
    </div>
  );
}
