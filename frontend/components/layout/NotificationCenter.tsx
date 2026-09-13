"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageSquare, Share2 } from "lucide-react";

import { useClickOutside } from "@/hooks/useClickOutside";
import { useNotifications } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/types/sharing";
import { cn } from "@/lib/utils";

const NOTIFICATION_ICON: Record<NotificationType, typeof Share2> = {
  content_shared: Share2,
  request_created: MessageSquare,
  request_resolved: MessageSquare,
};

type NotificationTab = "all" | "unread";

/** Navbar bell trigger + popover — badge count, All/Unread tabs, mark-as-read on click-through. */
export const NotificationCenter = () => {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  const visible = tab === "unread" ? notifications.filter((item) => !item.isRead) : notifications;

  const handleItemClick = (item: AppNotification) => {
    if (!item.isRead) void markRead(item.id);
    setIsOpen(false);
    if (item.actionUrl) router.push(item.actionUrl);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative border-2 border-transparent p-2 text-black transition hover:border-black"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center border border-black bg-brand-yellow font-mono text-[10px] font-bold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-40 mt-2 w-96 max-w-[90vw] border-2 border-black bg-white shadow-popover animate-modal-in"
        >
          <div className="flex items-center justify-between border-b border-black px-4 py-3">
            <h2 className="text-sm font-bold text-black">Notifications</h2>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-neutral-600 underline underline-offset-2 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>

          <div className="flex border-b border-black">
            {(["all", "unread"] as NotificationTab[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTab(option)}
                className={cn(
                  "flex-1 border-r border-black py-1.5 text-xs font-semibold uppercase tracking-wide last:border-r-0",
                  tab === option ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100",
                )}
              >
                {option === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
              </button>
            ))}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="p-6 text-center text-xs text-neutral-400">
                {tab === "unread" ? "No unread notifications." : "Nothing here yet."}
              </p>
            ) : (
              visible.map((item) => {
                const Icon = NOTIFICATION_ICON[item.notificationType];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      "flex w-full items-start gap-2.5 border-b border-black/10 px-4 py-3 text-left transition last:border-b-0 hover:bg-neutral-50",
                      !item.isRead && "border-l-4 border-l-brand-yellow bg-yellow-50/60",
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-black">{item.title}</p>
                      {item.message && <p className="mt-0.5 truncate text-xs text-neutral-500">{item.message}</p>}
                      <p className="mt-1 text-[10px] text-neutral-400" suppressHydrationWarning>
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
