import Link from "next/link";
import type { ReactNode } from "react";

/** Shell for every auth route: just the APC mark and a centered canvas — no dashboard chrome. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-canvas px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold text-black">
        <span className="flex h-8 w-8 items-center justify-center border-2 border-black bg-black text-xs font-bold text-white">
          APC
        </span>
        <span className="text-lg font-black tracking-tight">AI Paper Clip</span>
      </Link>
      {children}
    </div>
  );
}
