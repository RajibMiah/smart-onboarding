"use client";

import { LayoutGrid, Search, Table as TableIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface FilterChip {
  value: string;
  label: string;
}

export interface SelectFilter {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface EditorialFilterBarProps {
  /** Omit (along with `activeChip`/`onChipChange`) for a list that only needs the select dropdowns, e.g. Playlists. */
  chips?: FilterChip[];
  activeChip?: string;
  onChipChange?: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selects?: SelectFilter[];
  view?: "cards" | "table";
  onViewChange?: (view: "cards" | "table") => void;
}

/** Segmented filter chips + search + selects + cards/table toggle, all sharp-bordered. */
export function EditorialFilterBar({
  chips = [],
  activeChip,
  onChipChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  selects = [],
  view,
  onViewChange,
}: EditorialFilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const active = chip.value === activeChip;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onChipChange?.(chip.value)}
                aria-pressed={active}
                className={cn(
                  "border-2 border-black px-3 py-1.5 text-sm font-semibold transition",
                  active ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full border-2 border-black bg-white py-2 pl-9 pr-3 text-sm text-black outline-none focus:ring-0"
          />
        </div>

        {selects.map((select) => (
          <select
            key={select.id}
            aria-label={select.label}
            value={select.value}
            onChange={(event) => select.onChange(event.target.value)}
            className="border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black outline-none focus:ring-0"
          >
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}

        {view && onViewChange && (
          <div className="flex border-2 border-black">
            <button
              type="button"
              onClick={() => onViewChange("cards")}
              aria-pressed={view === "cards"}
              className={cn(
                "flex items-center gap-1.5 border-r-2 border-black px-3 py-2 text-sm font-semibold transition",
                view === "cards" ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100",
              )}
            >
              <LayoutGrid className="h-4 w-4" /> Cards
            </button>
            <button
              type="button"
              onClick={() => onViewChange("table")}
              aria-pressed={view === "table"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition",
                view === "table" ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100",
              )}
            >
              <TableIcon className="h-4 w-4" /> Table
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
