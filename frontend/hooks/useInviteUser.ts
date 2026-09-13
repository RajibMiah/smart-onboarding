"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  departmentsApi,
  invitationsApi,
  teamsApi,
  ApiError,
  type ApiDepartment,
  type ApiTeam,
  type InvitationWritePayload,
} from "@/lib/api-client";

export interface InviteUserFormValues {
  email: string;
  departmentId: string;
  teamId: string;
  tags: string[];
  isAuthorized: boolean;
  isCreator: boolean;
  isContentManager: boolean;
  isGlobalAdmin: boolean;
}

const INITIAL_VALUES: InviteUserFormValues = {
  email: "",
  departmentId: "",
  teamId: "",
  tags: [],
  isAuthorized: true,
  isCreator: true,
  isContentManager: false,
  isGlobalAdmin: false,
};

interface UseInviteUserOptions {
  /** Only fetches department/team options while true — pass the modal's `isOpen`. */
  isActive: boolean;
  onInvited?: () => void;
}

/** Owns the Invite User modal's form state, department/team options, and submission. */
export const useInviteUser = ({ isActive, onInvited }: UseInviteUserOptions) => {
  const [values, setValues] = useState<InviteUserFormValues>(INITIAL_VALUES);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    Promise.all([departmentsApi.list(), teamsApi.list()]).then(
      ([departmentPage, teamPage]) => {
        if (cancelled) return;
        setValues(INITIAL_VALUES);
        setError(null);
        setDepartments(departmentPage.results);
        setTeams(teamPage.results);
      },
      () => {
        if (cancelled) return;
        // Non-fatal — department/team assignment is just optional in the form.
        setValues(INITIAL_VALUES);
        setError(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isActive]);

  const setField = useCallback(<K extends keyof InviteUserFormValues>(key: K, value: InviteUserFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setValues((prev) => (prev.tags.includes(trimmed) ? prev : { ...prev, tags: [...prev.tags, trimmed] }));
  }, []);

  const removeTag = useCallback((tag: string) => {
    setValues((prev) => ({ ...prev, tags: prev.tags.filter((existing) => existing !== tag) }));
  }, []);

  const teamOptions = useMemo(
    () => (values.departmentId ? teams.filter((team) => team.department === values.departmentId) : teams),
    [teams, values.departmentId],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    const email = values.email.trim();
    if (!email) {
      setError("Enter an email address.");
      return false;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: InvitationWritePayload = {
        email,
        department: values.departmentId || null,
        team: values.teamId || null,
        tags: values.tags,
        is_authorized: values.isAuthorized,
        is_creator: values.isCreator,
        is_content_manager: values.isContentManager,
        is_global_admin: values.isGlobalAdmin,
      };
      await invitationsApi.create(payload);
      onInvited?.();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the invitation — try again.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [values, onInvited]);

  return { values, setField, addTag, removeTag, departments, teams: teamOptions, isSubmitting, error, submit };
};
