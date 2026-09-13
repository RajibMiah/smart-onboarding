import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: string;
  maxWidth?: "md" | "xl";
  children: ReactNode;
}

const WIDTH_CLASS: Record<NonNullable<AuthCardProps["maxWidth"]>, string> = {
  md: "max-w-md p-8",
  xl: "max-w-xl p-10",
};

/** Shared bordered, hard-shadowed container for every auth screen. */
export const AuthCard = ({ title, maxWidth = "md", children }: AuthCardProps) => {
  return (
    <div className={cn("w-full border border-black bg-white shadow-popover", WIDTH_CLASS[maxWidth])}>
      <h1 className="border-b border-black pb-4 text-center text-2xl font-black text-black">{title}</h1>
      <div className="pt-6">{children}</div>
    </div>
  );
};
