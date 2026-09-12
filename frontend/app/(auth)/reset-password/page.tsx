"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { useAuthForm } from "@/hooks/useAuthForm";
import type { PasswordResetRequest } from "@/types/auth";

export default function ResetPasswordPage() {
  const [sent, setSent] = useState(false);

  const { values, errors, isSubmitting, submitError, setField, handleSubmit } = useAuthForm<PasswordResetRequest>({
    initialValues: { email: "" },
    onSubmit: async () => {
      setSent(true);
    },
  });

  return (
    <AuthCard title="Reset Password">
      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-neutral-600">
            If an account exists for <span className="font-semibold text-black">{values.email}</span>, a reset link is on its way.
          </p>
          <Link href="/login" className="text-xs font-medium text-black underline underline-offset-2">
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {submitError && (
            <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <p className="text-sm text-neutral-600">Enter your email and we&apos;ll send you a link to reset your password.</p>

          <div>
            <label htmlFor="reset-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Email Address
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "reset-email-error" : undefined}
              className="w-full border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
            {errors.email && (
              <p id="reset-email-error" className="mt-1 text-xs text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-black py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            {isSubmitting ? "Sending…" : "Send reset link"}
          </button>

          <Link href="/login" className="text-center text-xs font-medium text-neutral-600 underline-offset-2 hover:underline">
            Back to login
          </Link>
        </form>
      )}
    </AuthCard>
  );
}
