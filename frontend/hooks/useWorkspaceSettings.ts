"use client";

import { useCallback, useEffect, useState } from "react";

import {
  departmentsApi,
  organizationsApi,
  teamsApi,
  ApiError,
  type ApiDepartment,
  type ApiOrganization,
  type ApiTeam,
  type WorkspaceUpdatePayload,
} from "@/lib/api-client";

interface UseWorkspaceSettingsResult {
  workspace: ApiOrganization | null;
  departments: ApiDepartment[];
  teams: ApiTeam[];
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  refresh: () => Promise<void>;
  updateWorkspace: (payload: WorkspaceUpdatePayload) => Promise<void>;
  transferOwnership: (newOwnerId: string) => Promise<void>;
  deleteWorkspace: (confirmName: string) => Promise<void>;
}

/** Drives /settings/workspace — the tenant-wide branding/retention/department overview. */
export function useWorkspaceSettings(): UseWorkspaceSettingsResult {
  const [workspace, setWorkspace] = useState<ApiOrganization | null>(null);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [org, departmentPage, teamPage] = await Promise.all([
        organizationsApi.current(),
        departmentsApi.list(),
        teamsApi.list(),
      ]);
      setWorkspace(org);
      setDepartments(departmentPage.results);
      setTeams(teamPage.results);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load workspace settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateWorkspace = useCallback(
    async (payload: WorkspaceUpdatePayload) => {
      if (!workspace) return;
      setIsSaving(true);
      try {
        const updated = await organizationsApi.update(workspace.id, payload);
        setWorkspace(updated);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't save workspace settings.");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [workspace],
  );

  const transferOwnership = useCallback(
    async (newOwnerId: string) => {
      if (!workspace) return;
      const updated = await organizationsApi.transferOwnership(workspace.id, newOwnerId);
      setWorkspace(updated);
    },
    [workspace],
  );

  const deleteWorkspace = useCallback(
    async (confirmName: string) => {
      if (!workspace) return;
      await organizationsApi.remove(workspace.id, confirmName);
    },
    [workspace],
  );

  return {
    workspace,
    departments,
    teams,
    isLoading,
    error,
    isSaving,
    refresh,
    updateWorkspace,
    transferOwnership,
    deleteWorkspace,
  };
}
