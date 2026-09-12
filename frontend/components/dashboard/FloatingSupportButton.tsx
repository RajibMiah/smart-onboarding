"use client";

import { MessageCircle } from "lucide-react";

export function FloatingSupportButton() {
  return (
    <button
      type="button"
      aria-label="Open help and support"
      className="fixed bottom-6 right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-apc-900 text-white shadow-popover transition hover:bg-apc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apc-accent"
    >
      <MessageCircle className="h-5 w-5" />
    </button>
  );
}
