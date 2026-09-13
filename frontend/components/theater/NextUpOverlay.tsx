"use client";

interface NextUpOverlayProps {
  nextClipTitle: string;
  secondsRemaining: number;
  onPlayNow: () => void;
  onCancel: () => void;
}

/** Cancelable auto-advance countdown, shown over the player once the active clip ends. */
export const NextUpOverlay = ({ nextClipTitle, secondsRemaining, onPlayNow, onCancel }: NextUpOverlayProps) => {
  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 border-2 border-black bg-white px-4 py-3 shadow-popover">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Next up in {secondsRemaining}s</p>
        <p className="max-w-[200px] truncate text-sm font-bold text-black">{nextClipTitle}</p>
      </div>
      <button
        type="button"
        onClick={onPlayNow}
        className="shrink-0 border border-black bg-brand-yellow px-2.5 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-500"
      >
        Play now
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 border border-black px-2.5 py-1.5 text-xs font-semibold text-black transition hover:bg-neutral-100"
      >
        Cancel
      </button>
    </div>
  );
};
