"use client";

import Link from "next/link";
import { ChevronLeft, Download, Pencil, Share2, Trash2, Link2 } from "lucide-react";

import { ItemActionMenu } from "@/components/library/ItemActionMenu";
import type { ClipVisibility } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ClipWatchHeaderProps {
  title: string;
  visibility: ClipVisibility;
  authorDepartment: string | null;
  authorTeam: string | null;
  /** May edit this clip's content — shows "Edit in Studio". */
  canEdit: boolean;
  /** The clip's own creator or a global admin — the narrower flag that gates
   *  changing visibility and deleting, even for a can_edit delegate. */
  isOwner: boolean;
  onEditInStudio: () => void;
  onShare: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  onVisibilityChange: (visibility: ClipVisibility) => void;
}

const VISIBILITY_OPTIONS: { value: ClipVisibility; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "private", label: "Private" },
  { value: "published", label: "Public" },
];

const VISIBILITY_BADGE: Record<ClipVisibility, { label: string; className: string }> = {
  private: { label: "Private", className: "border-amber-500 bg-amber-50 text-amber-700" },
  published: { label: "Public", className: "border-emerald-600 bg-emerald-50 text-emerald-700" },
  draft: { label: "Draft", className: "border-rose-500 bg-rose-50 text-rose-700" },
};

export const ClipWatchHeader = ({
  title,
  visibility,
  authorDepartment,
  authorTeam,
  canEdit,
  isOwner,
  onEditInStudio,
  onShare,
  onDownload,
  onCopyLink,
  onDelete,
  onVisibilityChange,
}: ClipWatchHeaderProps) => {
  const badge = VISIBILITY_BADGE[visibility];

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/library/clips"
          className="flex shrink-0 items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-black"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Library
        </Link>
        <h1 className="truncate text-lg font-bold text-black">{title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isOwner ? (
          <select
            value={visibility}
            onChange={(event) => onVisibilityChange(event.target.value as ClipVisibility)}
            aria-label="Clip visibility"
            className={cn("appearance-none border py-0.5 pl-2 pr-6 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-black", badge.className)}
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <span className={cn("border px-2 py-0.5 font-mono text-xs", badge.className)}>{badge.label}</span>
        )}
        {authorDepartment && <span className="border border-black px-2 py-0.5 font-mono text-xs text-black">{authorDepartment}</span>}
        {authorTeam && <span className="border border-black px-2 py-0.5 font-mono text-xs text-black">{authorTeam}</span>}

        {canEdit && (
          <button
            type="button"
            onClick={onEditInStudio}
            className="flex items-center gap-1.5 border border-black bg-black px-3 py-1.5 text-xs font-bold text-white transition hover:bg-neutral-800"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit in Studio
          </button>
        )}
        <button
          type="button"
          onClick={onShare}
          className="flex items-center gap-1.5 border border-black bg-brand-yellow px-3 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-500"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share / Request
        </button>
        <ItemActionMenu
          itemLabel={title}
          items={[
            { icon: Download, label: "Download Video", onClick: onDownload },
            { icon: Link2, label: "Copy Link", onClick: onCopyLink },
            ...(isOwner
              ? [{ icon: Trash2, label: "Delete Clip", tone: "danger" as const, onClick: onDelete, dividerBefore: true }]
              : []),
          ]}
        />
      </div>
    </header>
  );
};
