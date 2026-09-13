"use client";

import { useCallback, useEffect, useState } from "react";

import {
  customRolesApi,
  usersApi,
  ApiError,
  type ApiCustomRole,
  type ApiOrgUser,
  type ApiSystemRoleTier,
  type CustomRolePayload,
} from "@/lib/api-client";

interface UseRoleManagementResult {
  customRoles: ApiCustomRole[];
  isLoadingRoles: boolean;
  error: string | null;
  refreshRoles: () => Promise<void>;
  createCustomRole: (payload: CustomRolePayload) => Promise<ApiCustomRole>;
  removeCustomRole: (id: string) => Promise<void>;
  updateMemberRole: (userId: string, payload: { role_tier?: ApiSystemRoleTier; custom_role?: string | null }) => Promise<ApiOrgUser>;
  revokeMember: (userId: string) => Promise<ApiOrgUser>;
  reactivateMember: (userId: string) => Promise<ApiOrgUser>;
}

/** Manages custom role definitions plus per-member role assignment and revocation for /admin/users. */
export function useRoleManagement(): UseRoleManagementResult {
  const [customRoles, setCustomRoles] = useState<ApiCustomRole[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      const page = await customRolesApi.list();
      setCustomRoles(page.results);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load custom roles.");
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    void refreshRoles();
  }, [refreshRoles]);

  const createCustomRole = useCallback(async (payload: CustomRolePayload) => {
    const created = await customRolesApi.create(payload);
    setCustomRoles((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, []);

  const removeCustomRole = useCallback(async (id: string) => {
    await customRolesApi.remove(id);
    setCustomRoles((prev) => prev.filter((role) => role.id !== id));
  }, []);

  const updateMemberRole = useCallback(
    (userId: string, payload: { role_tier?: ApiSystemRoleTier; custom_role?: string | null }) =>
      usersApi.updateRole(userId, payload),
    [],
  );

  const revokeMember = useCallback((userId: string) => usersApi.revoke(userId), []);
  const reactivateMember = useCallback((userId: string) => usersApi.reactivate(userId), []);

  return {
    customRoles,
    isLoadingRoles,
    error,
    refreshRoles,
    createCustomRole,
    removeCustomRole,
    updateMemberRole,
    revokeMember,
    reactivateMember,
  };
}
