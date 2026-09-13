import type { ComponentType } from "react";
import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
}

/** Placeholder for sidebar routes not yet built — keeps navigation link-safe. */
export const ComingSoon = ({ title, description, icon: Icon = Construction }: ComingSoonProps) => {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 py-24 text-center">
      <Icon className="h-8 w-8 text-slate-400" />
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
};
