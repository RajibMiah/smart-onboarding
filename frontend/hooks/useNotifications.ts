"use client";

import { useCallback, useEffect, useState } from "react";

import { notificationsApi, ApiError, type ApiNotification } from "@/lib/api-client";
import type { AppNotification } from "@/types/sharing";

const POLL_INTERVAL_MS = 30_000;

const toAppNotification = (api: ApiNotification): AppNotification => ({
  id: api.id,
  sender: api.sender,
  senderName: api.sender_name,
  senderAvatarUrl: api.sender_avatar_url,
  notificationType: api.notification_type,
  title: api.title,
  message: api.message,
  actionUrl: api.action_url,
  isRead: api.is_read,
  createdAt: api.created_at,
});

interface UseNotificationsResult {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/** Drives the navbar bell: list + unread count, with light polling so the badge updates across tabs/sessions. */
export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const page = await notificationsApi.list();
      setNotifications(page.results.map(toAppNotification));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic — the badge/list should feel instant, and a failed PATCH
    // just means the next poll silently reconciles it back to unread.
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    try {
      await notificationsApi.markRead(id);
    } catch {
      // Reconciled by the next poll.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      // Reconciled by the next poll.
    }
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return { notifications, unreadCount, isLoading, error, refresh, markRead, markAllRead };
}
