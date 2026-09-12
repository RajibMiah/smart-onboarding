"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { Toast } from "@/components/ui/Toast";
import { useAuthForm } from "@/hooks/useAuthForm";
import { useToast } from "@/hooks/useToast";
import type { LoginCredentials } from "@/types/auth";

export default function LoginPage() {
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const { values, errors, isSubmitting, submitError, setField, handleSubmit } = useAuthForm<LoginCredentials>({
    initialValues: { email: "", password: "" },
    onSubmit: async () => {
      toast.show("Login isn't available in this offline preview yet.");
    },
  });

  return (
    <AuthCard title="Login Now">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => setField("email", event.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            className="w-full border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
          {errors.email && (
            <p id="login-email-error" className="mt-1 text-xs text-red-600">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={values.password}
              onChange={(event) => setField("password", event.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              className="w-full border border-black px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-black"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="login-password-error" className="mt-1 text-xs text-red-600">
              {errors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-black py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>

        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <span className="h-px flex-1 bg-black/10" />
          or
          <span className="h-px flex-1 bg-black/10" />
        </div>

        <Link
          href="/signup"
          className="block w-full border border-black py-2.5 text-center text-sm font-bold text-black transition hover:bg-brand-yellow"
        >
          Sign Up
        </Link>

        <Link href="/reset-password" className="text-center text-xs font-medium text-neutral-600 underline-offset-2 hover:underline">
          Reset Password
        </Link>

        <div className="border-t border-black pt-4">
          <OAuthButtons onNotify={toast.show} />
        </div>
      </form>

      {toast.message && <Toast message={toast.message} />}
    </AuthCard>
  );
}
