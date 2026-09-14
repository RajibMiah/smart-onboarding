"use client";

import { useCallback, useEffect, useState } from "react";

import {
  sharedContentApi,
  ApiError,
  type ApiSharedContent,
  type ShareCapabilityUpdate,
  type ShareDashboardQuery,
} from "@/lib/api-client";

export interface ManagedShare {
  id: string;
  contentType: "clip" | "playlist";
  objectId: string;
  contentTitle: string;
  contentThumbnailUrl: string;
  sharedById: string;
  sharedByName: string;
  targetKind: "user" | "team" | "department";
  targetLabel: string;
  canView: boolean;
  canEdit: boolean;
  canReorder: boolean;
  canReshare: boolean;
  parentShareId: string | null;
  isActive: boolean;
  revokedAt: string | null;
  revokedByName: string | null;
  /** Whether the *current* user may edit this row's flags or revoke it. */
  canManage: boolean;
  createdAt: string;
}

const toManagedShare = (item: ApiSharedContent): ManagedShare => ({
  id: item.id,
  contentType: item.content_type,
  objectId: item.object_id,
  contentTitle: item.content_title,
  contentThumbnailUrl: item.content_thumbnail_url,
  sharedById: item.shared_by,
  sharedByName: item.shared_by_name,
  targetKind: item.target_user ? "user" : item.target_team ? "team" : "department",
  targetLabel: item.target_user_name ?? item.target_team_name ?? item.target_department_name ?? "Unknown",
  canView: item.can_view,
  canEdit: item.can_edit,
  canReorder: item.can_reorder,
  canReshare: item.can_reshare,
  parentShareId: item.parent_share,
  isActive: item.is_active,
  revokedAt: item.revoked_at,
  revokedByName: item.revoked_by_name ?? null,
  canManage: item.can_manage,
  createdAt: item.created_at,
});

export type ShareStatusFilter = "all" | "active" | "revoked";
export type ShareScopeFilter = "all" | "shared_by_me" | "shared_with_me";
export type ShareResourceFilter = "all" | "clip" | "playlist";
export type ShareTargetFilter = "all" | "user" | "team" | "department";

/**
 * Drives the Share Management dashboard: fetches the caller's scoped slice
 * of the delegation tree (everything on content they own, plus every share
 * they personally issued elsewhere — see `SharedContentViewSet.dashboard`),
 * and exposes capability-toggle and revoke mutations. Revoking refetches the
 * whole list rather than predicting the effect locally, since a cascade
 * revoke can deactivate an arbitrary number of downstream rows server-side.
 */
export function useShareManagement() {
  const [shares, setShares] = useState<ManagedShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const [scope, setScope] = useState<ShareScopeFilter>("all");
  const [status, setStatus] = useState<ShareStatusFilter>("active");
  const [resourceType, setResourceType] = useState<ShareResourceFilter>("all");
  const [targetType, setTargetType] = useState<ShareTargetFilter>("all");
  const [search, setSearch] = useState("");

  const buildQuery = useCallback((): ShareDashboardQuery => {
    const query: ShareDashboardQuery = {};
    if (scope !== "all") query.scope = scope;
    if (status !== "all") query.status = status;
    if (resourceType !== "all") query.resource_type = resourceType;
    if (targetType !== "all") query.target_type = targetType;
    if (search.trim()) query.search = search.trim();
    return query;
  }, [scope, status, resourceType, targetType, search]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await sharedContentApi.dashboard(buildQuery());
      setShares(results.map(toManagedShare));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load shares.");
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery]);

  // Duplicates `refresh`'s body (rather than calling it) so every setState
  // call below happens inside the `.then` callbacks — which fire
  // asynchronously after this effect has already returned — instead of
  // synchronously during the effect body itself.
  useEffect(() => {
    let cancelled = false;
    sharedContentApi.dashboard(buildQuery()).then(
      (results) => {
        if (cancelled) return;
        setShares(results.map(toManagedShare));
        setError(null);
        setIsLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load shares.");
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [buildQuery]);

  const updateCapabilities = useCallback(async (id: string, update: ShareCapabilityUpdate) => {
    setMutatingId(id);
    try {
      const updated = await sharedContentApi.updateCapabilities(id, update);
      setShares((prev) => prev.map((share) => (share.id === id ? toManagedShare(updated) : share)));
    } finally {
      setMutatingId(null);
    }
  }, []);

  const revokeShare = useCallback(
    async (id: string) => {
      setMutatingId(id);
      try {
        await sharedContentApi.revoke(id);
        await refresh(); // a cascade revoke can deactivate other rows too — simplest to just re-fetch
      } finally {
        setMutatingId(null);
      }
    },
    [refresh],
  );

  return {
    shares,
    isLoading,
    error,
    mutatingId,
    refresh,
    scope,
    setScope,
    status,
    setStatus,
    resourceType,
    setResourceType,
    targetType,
    setTargetType,
    search,
    setSearch,
    updateCapabilities,
    revokeShare,
    totalActive: shares.filter((share) => share.isActive).length,
    totalDelegated: shares.filter((share) => share.parentShareId !== null).length,
  };
}
