import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The GhushSite-style 4-tier editorial card: a black-bordered, hard-shadowed
 * box with a header strip (category + metric badges), an optional tag row,
 * a body, and a full-width yellow action footer. Compound API so each tier
 * can be composed/omitted per use case (dashboard decks, library rows, …).
 */
function EditorialCard({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex flex-col border-2 border-black bg-white shadow-card", className ?? "")}
      {...props}
    >
      {children}
    </div>
  );
}

interface HeaderStripProps {
  /** e.g. "#01" — omit for items that don't need an index. */
  index?: string;
  categoryLabel: string;
  metricLabel?: string;
  className?: string;
}

function HeaderStrip({ index, categoryLabel, metricLabel, className }: HeaderStripProps) {
  return (
    <div className={cn("flex items-stretch justify-between border-b-2 border-black", className ?? "")}>
      <div className="flex items-stretch">
        {index && (
          <span className="flex items-center border-r-2 border-black bg-black px-2 font-mono text-xs font-bold text-white">
            {index}
          </span>
        )}
        <span className="flex items-center border-r-2 border-black bg-brand-yellow px-2.5 py-1 text-xs font-bold text-black">
          {categoryLabel}
        </span>
      </div>
      {metricLabel && (
        <span className="flex items-center bg-black px-3 font-mono text-xs font-bold text-white">
          {metricLabel}
        </span>
      )}
    </div>
  );
}

interface TagRowProps {
  tags: { label: string; tone?: "yellow" | "outline" }[];
  className?: string;
}

function TagRow({ tags, className }: TagRowProps) {
  if (tags.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5 border-b border-black/20 p-2", className ?? "")}>
      {tags.map(({ label, tone = "outline" }) => (
        <span
          key={label}
          className={cn(
            "border border-black px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            tone === "yellow" ? "bg-brand-yellow text-black" : "bg-white text-black",
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

interface BodyProps {
  title: string;
  /** Monospace metadata line — location, id, timestamp, etc. */
  metaLine?: string;
  description?: string;
  thumbnail?: ReactNode;
  className?: string;
}

function Body({ title, metaLine, description, thumbnail, className }: BodyProps) {
  return (
    <div className={cn("flex flex-col gap-2 p-3", className ?? "")}>
      {thumbnail && <div className="overflow-hidden border border-black">{thumbnail}</div>}
      <h3 className="text-base font-bold leading-tight tracking-tight text-black">{title}</h3>
      {/* metaLine sometimes carries a relative-time string ("Updated 8 minutes
          ago") — that text is computed against "now", so it can legitimately
          differ by a few seconds between server render and client hydration.
          suppressHydrationWarning is React's documented fix for exactly this. */}
      {metaLine && (
        <p className="text-xs text-neutral-500" suppressHydrationWarning>
          {metaLine}
        </p>
      )}
      {description && <p className="text-sm leading-snug text-neutral-700">{description}</p>}
    </div>
  );
}

interface FooterProps {
  label: string;
  counter?: string | number;
  onClick?: () => void;
  href?: string;
  className?: string;
}

function Footer({ label, counter, onClick, href, className }: FooterProps) {
  const content = (
    <>
      <span className="truncate">{label}</span>
      {counter !== undefined && (
        <span className="shrink-0 border-l-2 border-black pl-3 tabular-nums">{counter}</span>
      )}
    </>
  );

  const sharedClassName = cn(
    "flex w-full items-center justify-between gap-3 border-t-2 border-black bg-brand-yellow px-3 py-2 text-xs font-semibold text-black transition hover:bg-yellow-500",
    className ?? "",
  );

  if (href) {
    return (
      <a href={href} className={sharedClassName}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={sharedClassName}>
      {content}
    </button>
  );
}

/** Flat, calm placeholder for a missing thumbnail — a busy striped pattern here is exactly the kind of visual noise the editorial style should avoid. */
function HatchPlaceholder({ className, as: As = "div" }: { className?: string; as?: ElementType }) {
  return (
    <As className={cn("flex h-full w-full flex-col items-center justify-center gap-1 bg-neutral-50 text-neutral-400", className ?? "")}>
      <ImageOff className="h-5 w-5" />
      <span className="text-[11px] font-medium">No preview</span>
    </As>
  );
}

EditorialCard.HeaderStrip = HeaderStrip;
EditorialCard.TagRow = TagRow;
EditorialCard.Body = Body;
EditorialCard.Footer = Footer;
EditorialCard.HatchPlaceholder = HatchPlaceholder;

export { EditorialCard };
