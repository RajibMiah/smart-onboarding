"use client";

import { useCallback, useEffect, useState } from "react";

import { authApi, teamsApi, ApiError, type ApiTeam, type ApiUser } from "@/lib/api-client";

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  location: string;
  teamId: string;
}

const toFormValues = (user: ApiUser | null): ProfileFormValues => ({
  firstName: user?.first_name ?? "",
  lastName: user?.last_name ?? "",
  location: user?.location ?? "",
  teamId: user?.membership?.team?.id ?? "",
});

interface UseUserProfileResult {
  profile: ApiUser | null;
  isLoading: boolean;
  error: string | null;
  teams: ApiTeam[];
  values: ProfileFormValues;
  setField: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;
  isDirty: boolean;
  isSaving: boolean;
  save: () => Promise<ApiUser>;
  discard: () => void;
  isUploadingAvatar: boolean;
  uploadAvatar: (file: File) => Promise<ApiUser>;
}

/** Hydrates + edits the current user's own "My Account" profile, including team switching and avatar upload. */
export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ProfileFormValues>(toFormValues(null));
  const [savedValues, setSavedValues] = useState<ProfileFormValues>(toFormValues(null));
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([authApi.me(), teamsApi.list()]).then(
      ([me, teamPage]) => {
        if (cancelled) return;
        setProfile(me);
        setTeams(teamPage.results);
        setValues(toFormValues(me));
        setSavedValues(toFormValues(me));
        setIsLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load your profile.");
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = useCallback(<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isDirty = (Object.keys(savedValues) as (keyof ProfileFormValues)[]).some((key) => values[key] !== savedValues[key]);

  const discard = useCallback(() => setValues(savedValues), [savedValues]);

  const save = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await authApi.updateMe({
        first_name: values.firstName,
        last_name: values.lastName,
        location: values.location,
        team_id: values.teamId || null,
      });
      setProfile(updated);
      setValues(toFormValues(updated));
      setSavedValues(toFormValues(updated));
      return updated;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your changes — try again.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [values]);

  const uploadAvatar = useCallback(async (file: File) => {
    setIsUploadingAvatar(true);
    setError(null);
    try {
      const updated = await authApi.uploadAvatar(file);
      setProfile(updated);
      return updated;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that image — try again.");
      throw err;
    } finally {
      setIsUploadingAvatar(false);
    }
  }, []);

  return { profile, isLoading, error, teams, values, setField, isDirty, isSaving, save, discard, isUploadingAvatar, uploadAvatar };
}
