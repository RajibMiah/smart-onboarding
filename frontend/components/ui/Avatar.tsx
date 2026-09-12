import { cn } from "@/lib/utils";

interface AvatarProps {
  initials: string;
  gradient?: string;
  size?: "sm" | "md" | "lg";
  /** Fill the parent instead of using a fixed `size` — for a container that
   *  already controls the dimensions (e.g. a bigger profile-page circle). */
  fill?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

/** Circular initials avatar with a gradient fill — no external image dependency. */
export function Avatar({ initials, gradient = "from-slate-600 to-slate-800", size = "md", fill = false, className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white",
        gradient,
        fill ? "h-full w-full text-3xl" : SIZE_CLASSES[size],
        className ?? "",
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
