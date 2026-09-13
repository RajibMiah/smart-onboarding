import type { ComponentType } from "react";
import { Inbox } from "lucide-react";

interface LibraryEmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Shown when a library list has nothing yet, or nothing matches the active search/filter. */
export const LibraryEmptyState = ({ icon: Icon = Inbox, title, description, actionLabel, onAction }: LibraryEmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-black py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center border-2 border-black bg-white">
        <Icon className="h-6 w-6 text-black" />
      </span>
      <div>
        <p className="font-bold text-black">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-neutral-600">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 border-2 border-black bg-white px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-neutral-100"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
