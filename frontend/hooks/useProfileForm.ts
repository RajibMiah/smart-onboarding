"use client";

import { useCallback, useMemo, useState } from "react";

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  location: string;
  department: string;
  team: string;
  language: string;
}

interface UseProfileFormOptions {
  initialValues: ProfileFormValues;
  onSave?: (values: ProfileFormValues) => Promise<void> | void;
}

interface UseProfileFormResult {
  values: ProfileFormValues;
  setField: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  save: () => void;
  discard: () => void;
}

/**
 * Profile form state with dirty tracking. Dirty is measured against the last
 * *saved* snapshot (not the original `initialValues` prop) — otherwise the
 * "Save changes" bar would never go away after a successful save, since the
 * prop itself never changes.
 */
export const useProfileForm = ({ initialValues, onSave }: UseProfileFormOptions): UseProfileFormResult => {
  const [values, setValues] = useState(initialValues);
  const [savedValues, setSavedValues] = useState(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = useMemo(
    () => (Object.keys(savedValues) as (keyof ProfileFormValues)[]).some((key) => values[key] !== savedValues[key]),
    [values, savedValues],
  );

  const setField = useCallback(
    <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const discard = useCallback(() => setValues(savedValues), [savedValues]);

  const save = useCallback(() => {
    setIsSaving(true);
    setSaveError(null);
    Promise.resolve(onSave?.(values))
      .then(() => setSavedValues(values))
      .catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : "Couldn't save your changes — try again.");
      })
      .finally(() => setIsSaving(false));
  }, [values, onSave]);

  return { values, setField, isDirty, isSaving, saveError, save, discard };
};
