"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, LogOut, MessageCircle, Settings, Sparkles, Tv } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { useClickOutside } from "@/hooks/useClickOutside";
import type { AppUser } from "@/lib/types";
import { cn } from "@/lib/utils";

interface UserMenuDropdownProps {
  user: AppUser;
  avatarUrl?: string | null;
  /** Called for every item that isn't a real route (Contact Support, News, Logout, …). */
  onStubAction: (label: string) => void;
}

const ACCOUNT_HREF = "/settings/account";

interface StubMenuItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const STUB_ITEMS: StubMenuItem[] = [
  { label: "Contact Support", icon: MessageCircle },
  { label: "Video Tutorials", icon: Tv },
  { label: "Help Center", icon: HelpCircle },
  { label: "News", icon: Sparkles },
];

/** Avatar flyout in the top bar — account link, stubbed support links, logout. */
export function UserMenuDropdown({ user, avatarUrl, onStubAction }: UserMenuDropdownProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isOnAccountPage = pathname === ACCOUNT_HREF;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-apc-accent"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- object-URL avatar preview
          <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <Avatar initials={user.initials} gradient="from-rose-500 to-orange-600" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden border-2 border-black bg-white py-1.5 shadow-popover animate-modal-in"
        >
          <Link
            href={ACCOUNT_HREF}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-sm transition",
              isOnAccountPage ? "bg-brand-yellow font-semibold text-black" : "text-black hover:bg-neutral-100",
            )}
          >
            <Settings className="h-4 w-4" />
            My Account
          </Link>

          <div className="my-1 h-px bg-black/15" />

          {STUB_ITEMS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onStubAction(label);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-black transition hover:bg-neutral-100"
            >
              <Icon className="h-4 w-4 text-neutral-500" />
              {label}
            </button>
          ))}

          <div className="my-1 h-px bg-black/15" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onStubAction("Logout");
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-black transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
