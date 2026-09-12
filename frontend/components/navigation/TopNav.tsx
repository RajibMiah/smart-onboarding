"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, FileText, ListVideo, Menu, MessageSquarePlus, Plus, Search } from "lucide-react";

import { useClickOutside } from "@/hooks/useClickOutside";
import { useToast } from "@/hooks/useToast";
import { useUI } from "@/context/ui-context";
import { Toast } from "@/components/ui/Toast";
import { UserMenuDropdown } from "@/components/navigation/UserMenuDropdown";
import { cn } from "@/lib/utils";

interface CreateMenuOption {
  id: string;
  label: string;
  icon: typeof FileText;
}

const CREATE_MENU_OPTIONS: CreateMenuOption[] = [
  { id: "page", label: "New Page", icon: FileText },
  { id: "playlist", label: "New Playlist", icon: ListVideo },
  { id: "request", label: "New Request", icon: MessageSquarePlus },
];

/** Sharp-edged top bar — solid black bottom rule, black/yellow action cluster. */
export function TopNav() {
  const { user, avatarUrl } = useUI();
  const toast = useToast();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b-2 border-black bg-white px-4 sm:gap-4 sm:px-6">
      <MobileMenuButton />
      <Logo />
      <SearchBar />
      <div className="flex items-center gap-2 sm:gap-3">
        <CreateSplitButton />
        <NotificationButton />
        <UserMenuDropdown
          user={user}
          avatarUrl={avatarUrl}
          onStubAction={(label) => toast.show(`${label} isn't available in this preview yet.`)}
        />
      </div>
      {toast.message && <Toast message={toast.message} />}
    </header>
  );
}

function MobileMenuButton() {
  const { openMobileSidebar } = useUI();
  return (
    <button
      type="button"
      onClick={openMobileSidebar}
      className="-ml-1 border-2 border-transparent p-2 text-black transition hover:border-black lg:hidden"
      aria-label="Open navigation menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-black">
      <span className="flex h-7 w-7 items-center justify-center border-2 border-black bg-black text-xs font-bold text-white">
        APC
      </span>
      <span className="hidden text-lg font-black tracking-tight sm:inline">AI Paper Clip</span>
    </Link>
  );
}

function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the search field from anywhere in the app.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isShortcut) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative mx-auto hidden w-full max-w-xl flex-1 sm:block">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search for recordings, pages..."
        className="w-full border-2 border-black bg-white py-2.5 pl-10 pr-14 text-sm text-black outline-none transition placeholder:text-neutral-500 focus:ring-0"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 border border-black bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-black">
        ⌘K
      </kbd>
    </div>
  );
}

function CreateSplitButton() {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setMenuOpen(false), menuOpen);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex border-2 border-black text-sm font-semibold text-white shadow-hard-sm">
        <Link
          href="/studio"
          className="flex items-center gap-1.5 bg-black px-3.5 py-2 transition hover:bg-neutral-800 sm:px-4"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Recording</span>
        </Link>
        <div className="w-0.5 bg-white/20" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center bg-black px-2 transition hover:bg-neutral-800"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More creation options"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", menuOpen && "rotate-180")} />
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-52 border-2 border-black bg-white py-1.5 shadow-popover animate-modal-in"
        >
          {CREATE_MENU_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                toast.show(`${label} isn't available in this preview yet.`);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-black transition hover:bg-neutral-100"
            >
              <Icon className="h-4 w-4 text-neutral-500" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationButton() {
  return (
    <button
      type="button"
      className="relative border-2 border-transparent p-2 text-black transition hover:border-black"
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5" />
      <span className="absolute right-1.5 top-1.5 h-2 w-2 border border-black bg-brand-yellow" />
    </button>
  );
}
