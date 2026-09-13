"use client";

import { useCallback, useEffect, useState } from "react";

import { sharedFeedApi, ApiError, type ApiSharedFeedItem } from "@/lib/api-client";
import type { SharedFeedItem } from "@/types/sharing";

const toSharedFeedItem = (api: ApiSharedFeedItem): SharedFeedItem => ({
  id: api.id,
  kind: api.kind,
  contentType: api.content_type,
  objectId: api.object_id,
  contentTitle: api.content_title,
  contentThumbnailUrl: api.content_thumbnail_url,
  actorName: api.actor_name,
  actorAvatarUrl: api.actor_avatar_url,
  targetLabel: api.target_label,
  permission: api.permission,
  requestType: api.request_type,
  status: api.status,
  createdAt: api.created_at,
});

interface UseSharedFeedResult {
  items: SharedFeedItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Drives /shared (with_me) and /shared/by-me (by_me) — a merged feed of plain shares + share-requests. */
export function useSharedFeed(scope: "with_me" | "by_me"): UseSharedFeedResult {
  const [items, setItems] = useState<SharedFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await sharedFeedApi.list(scope);
      setItems(page.results.map(toSharedFeedItem));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the shared feed.");
    } finally {
      setIsLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, isLoading, error, refresh };
}
