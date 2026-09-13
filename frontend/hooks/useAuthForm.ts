"use client";

import { useCallback, useState, type FormEvent } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PasswordStrength = "weak" | "fair" | "strong";

export const isValidEmail = (email: string): boolean => {
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Heuristic strength score (length + character variety) for a "create
 * password" step — not currently wired into a field (this app's auth flows
 * are login-with-existing-password and OTP-based signup, neither of which
 * collects a new password yet), kept here ready for when one does.
 */
export const getPasswordStrength = (password: string): PasswordStrength => {
  if (password.length === 0) return "weak";
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return "weak";
  if (score <= 3) return "fair";
  return "strong";
};

interface UseAuthFormOptions<T extends object> {
  initialValues: T;
  /** Runs once client-side validation passes — the API call (a timed stub) lives here. */
  onSubmit: (values: T) => Promise<void> | void;
}

/**
 * Generic auth form state: any shape with an `email` and/or `password` field
 * gets those validated automatically (duck-typed via `in`, so the same hook
 * serves login, signup, and reset-password without a schema per page).
 */
export const useAuthForm = <T extends object>({ initialValues, onSubmit }: UseAuthFormOptions<T>) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      // Duck-typed against a loosely-keyed view of `values` — the public
      // generic stays a plain `object` so callers don't need an index
      // signature on their own form-shape interfaces.
      const record = values as Record<string, unknown>;
      const nextErrors: Partial<Record<keyof T, string>> = {};

      if ("email" in record && !isValidEmail(String(record.email ?? ""))) {
        nextErrors["email" as keyof T] = "Enter a valid email address.";
      }
      if ("password" in record && String(record.password ?? "").length < 8) {
        nextErrors["password" as keyof T] = "Password must be at least 8 characters.";
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);
      Promise.resolve(onSubmit(values))
        .catch((error: unknown) => {
          setSubmitError(error instanceof Error ? error.message : "Something went wrong — please try again.");
        })
        .finally(() => setIsSubmitting(false));
    },
    [values, onSubmit],
  );

  return { values, errors, isSubmitting, submitError, setField, handleSubmit };
};
