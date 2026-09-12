"use client";

import Link from "next/link";
import { ChevronLeft, Link2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface ReviewHeaderProps {
  onEditClick: () => void;
  isPublished: boolean;
  onTogglePublished: () => void;
  onEnableVersioning: () => void;
  onDone: () => void;
}

/** Top action bar for the Review & Publish page — no dashboard chrome, mirrors the Studio's own header. */
export function ReviewHeader({ onEditClick, isPublished, onTogglePublished, onEnableVersioning, onDone }: ReviewHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-black px-4">
      <button
        type="button"
        onClick={onEditClick}
        className="flex items-center gap-1 border border-black px-3 py-1.5 text-xs font-bold text-black transition hover:bg-neutral-100"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Edit
      </button>

      <Link href="/" className="flex items-center gap-2 font-semibold text-black">
        <span className="flex h-7 w-7 items-center justify-center border-2 border-black bg-black text-xs font-bold text-white">APC</span>
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={isPublished}
          onClick={onTogglePublished}
          className="flex items-center gap-2 border border-black px-2.5 py-1.5 text-xs font-semibold"
        >
          <span className={cn("relative h-4 w-8 rounded-full transition", isPublished ? "bg-emerald-600" : "bg-neutral-300")}>
            <span
              className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                isPublished ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </span>
          <span className={isPublished ? "text-emerald-700" : "text-neutral-500"}>{isPublished ? "Published" : "Draft"}</span>
        </button>

        <button
          type="button"
          onClick={onEnableVersioning}
          className="flex items-center gap-1.5 border border-black px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-neutral-100"
        >
          <Link2 className="h-3.5 w-3.5" />
          Enable versioning
        </button>

        <button
          type="button"
          onClick={onDone}
          className="border border-black bg-black px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-neutral-800"
        >
          Done ✓
        </button>
      </div>
    </header>
  );
}
