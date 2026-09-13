"use client";

import { useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  Home,
  Inbox,
  LayoutDashboard,
  Library,
  ListVideo,
  Settings,
  Share2,
  Video,
  X,
} from "lucide-react";

import { useUI } from "@/context/ui-context";
import { useClickOutside } from "@/hooks/useClickOutside";
import { usePendingRequestCount } from "@/hooks/useMediaRequests";
import { cn } from "@/lib/utils";

interface SubNavItem {
  label: string;
  /** Real route when this sub-item is actually built; otherwise decorative. */
  href?: string;
  icon?: ComponentType<{ className?: string }>;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  subItems?: SubNavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { id: "start", label: "Start", href: "/", icon: Home },
  {
    id: "my-library",
    label: "My Library",
    href: "/library",
    icon: Library,
    subItems: [
      { label: "Clips", href: "/library/clips", icon: Video },
      { label: "Pages", href: "/library/pages", icon: FileText },
      { label: "Playlists", href: "/library/playlists", icon: ListVideo },
    ],
  },
  { id: "projects", label: "Projects", href: "/projects", icon: Folder },
  {
    id: "shared-with-me",
    label: "Shared with me",
    href: "/shared",
    icon: Share2,
    subItems: [{ label: "Shared by me" }, { label: "Shared with me" }],
  },
  { id: "requests", label: "Requests", href: "/requests", icon: Inbox },
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    subItems: [{ label: "Overview" }, { label: "Analytics" }],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    subItems: [
      { label: "My Account", href: "/settings/account" },
      { label: "Manage Users", href: "/admin/users" },
      { label: "Workspace" },
    ],
  },
];

const isItemActive = (pathname: string, href: string): boolean => {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
};

/** Shared nav list — rendered once for desktop, once inside the mobile drawer. */
const NavList = ({ collapsed }: { collapsed: boolean }) => {
  const pathname = usePathname();
  const pendingRequestCount = usePendingRequestCount();
  // Manual expand/collapse for sections that *aren't* the active route —
  // the section containing the current page (e.g. "My Library" under any
  // /library/* route) is always forced open below, no state needed for that.
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setManuallyExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
      {NAV_ITEMS.map(({ id, label, href, icon: Icon, subItems }) => {
        const active = isItemActive(pathname, href);
        const isActiveSection = href !== "/" && pathname.startsWith(href);
        const isExpanded = isActiveSection || manuallyExpanded.has(id);

        return (
          <div key={id}>
            <div
              className={cn(
                "group flex items-center text-sm font-medium transition",
                active ? "bg-brand-yellow text-black" : "text-black hover:bg-neutral-100",
              )}
            >
              <Link
                href={href}
                className={cn(
                  "relative flex min-w-0 flex-1 items-center gap-3 px-3 py-2",
                  collapsed && "justify-center px-0",
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
                {id === "requests" && pendingRequestCount > 0 && (
                  <span
                    className={cn(
                      "shrink-0 border border-black bg-black px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-white",
                      collapsed ? "absolute right-1 top-1" : "ml-auto",
                    )}
                  >
                    {pendingRequestCount}
                  </span>
                )}
              </Link>
              {!collapsed && subItems && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(id)}
                  className="mr-1.5 p-1 text-black/50 hover:bg-black/10 hover:text-black"
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label}`}
                  aria-expanded={isExpanded}
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                </button>
              )}
            </div>

            {!collapsed && subItems && isExpanded && (
              <div className="ml-8 flex flex-col gap-0.5 border-l-2 border-black pl-3 py-1">
                {subItems.map((sub) => {
                  const subActive = sub.href ? pathname === sub.href : false;
                  const SubIcon = sub.icon;
                  const content = (
                    <>
                      {SubIcon && <SubIcon className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{sub.label}</span>
                    </>
                  );
                  const itemClasses = cn(
                    "flex items-center gap-2 px-2 py-1.5 text-sm transition",
                    subActive
                      ? "bg-brand-yellow font-semibold text-black"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-black",
                  );

                  return sub.href ? (
                    <Link key={sub.label} href={sub.href} className={itemClasses}>
                      {content}
                    </Link>
                  ) : (
                    <span key={sub.label} className={cn(itemClasses, "cursor-default")}>
                      {content}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
};

export const Sidebar = () => {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUI();

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col border-r-2 border-black bg-white transition-[width] duration-200 lg:flex",
          sidebarCollapsed ? "w-16" : "w-60",
        )}
      >
        <NavList collapsed={sidebarCollapsed} />
        <div className="border-t-2 border-black p-2">
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-black transition hover:bg-neutral-100",
              sidebarCollapsed && "justify-center px-0",
            )}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!sidebarCollapsed && "Collapse Sidebar"}
          </button>
        </div>
      </aside>

      <MobileDrawer />
    </>
  );
};

const MobileDrawer = () => {
  const { mobileSidebarOpen, closeMobileSidebar } = useUI();
  const panelRef = useRef<HTMLDivElement>(null);

  useClickOutside(panelRef, closeMobileSidebar, mobileSidebarOpen);

  if (!mobileSidebarOpen) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute left-0 top-0 flex h-full w-64 flex-col border-r-2 border-black bg-white shadow-popover animate-modal-in"
      >
        <div className="flex h-16 items-center justify-between border-b-2 border-black px-4">
          <span className="text-lg font-black text-black">APC</span>
          <button
            type="button"
            onClick={closeMobileSidebar}
            className="p-2 text-black hover:bg-neutral-100"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavList collapsed={false} />
      </div>
    </div>
  );
};
