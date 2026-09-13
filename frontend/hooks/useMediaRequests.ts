"use client";

import { useCallback, useEffect, useState } from "react";

import {
  shareRequestsApi,
  ApiError,
  type ApiMediaShareRequest,
  type ApiRequestAction,
  type MediaShareRequestPayload,
} from "@/lib/api-client";
import type { MediaShareRequest } from "@/types/sharing";

const toMediaShareRequest = (api: ApiMediaShareRequest): MediaShareRequest => ({
  id: api.id,
  createdBy: api.created_by,
  createdByName: api.created_by_name,
  contentType: api.content_type,
  objectId: api.object_id,
  contentTitle: api.content_title,
  contentThumbnailUrl: api.content_thumbnail_url,
  targetUserId: api.target_user,
  targetUserName: api.target_user_name,
  targetTeamId: api.target_team,
  targetTeamName: api.target_team_name,
  targetDepartmentId: api.target_department,
  targetDepartmentName: api.target_department_name,
  requestType: api.request_type,
  priority: api.priority,
  status: api.status,
  message: api.message,
  dueDate: api.due_date,
  resolutionNote: api.resolution_note,
  resolvedAt: api.resolved_at,
  createdAt: api.created_at,
  updatedAt: api.updated_at,
});

export type RequestInboxScope = "assigned_to_me" | "created_by_me" | "archived";

interface UseMediaRequestsResult {
  requests: MediaShareRequest[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createRequest: (payload: MediaShareRequestPayload) => Promise<MediaShareRequest>;
  resolveRequest: (id: string, action: ApiRequestAction, note?: string) => Promise<void>;
}

/** Drives the Requests inbox page — one scope ("assigned to me" or "created by me") per instance. */
export function useMediaRequests(scope: RequestInboxScope, filters: Record<string, string> = {}): UseMediaRequestsResult {
  const [requests, setRequests] = useState<MediaShareRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await shareRequestsApi.list({ filter: scope, ...filters });
      setRequests(page.results.map(toMediaShareRequest));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load requests.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filters` is typically an inline object; stringify to avoid refetch loops
  }, [scope, JSON.stringify(filters)]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createRequest = useCallback(async (payload: MediaShareRequestPayload) => {
    const created = await shareRequestsApi.create(payload);
    return toMediaShareRequest(created);
  }, []);

  const resolveRequest = useCallback(async (id: string, action: ApiRequestAction, note = "") => {
    const updated = await shareRequestsApi.resolve(id, action, note);
    setRequests((prev) => prev.map((request) => (request.id === id ? toMediaShareRequest(updated) : request)));
  }, []);

  return { requests, isLoading, error, refresh, createRequest, resolveRequest };
}

/** Lightweight count-only query for the sidebar's "Requests" badge. */
export function usePendingRequestCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    shareRequestsApi.list({ filter: "assigned_to_me", status: "pending" }).then(
      (page) => {
        if (!cancelled) setCount(page.count);
      },
      () => {
        // Non-fatal — the badge just won't show a number.
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
