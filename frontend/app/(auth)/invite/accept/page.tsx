"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { invitationsApi, ApiError, type InvitationVerification } from "@/lib/api-client";

const AcceptInvitePage = () => {
  return (
    <Suspense>
      <AcceptInviteContent />
    </Suspense>
  );
};
export default AcceptInvitePage;

type LoadState =
  | { phase: "loading" }
  | { phase: "invalid"; message: string }
  | { phase: "ready"; invitation: InvitationVerification };

const AcceptInviteContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  // Lazy initializer so the "missing token" case is resolved synchronously from
  // the URL at first render, instead of needing a synchronous setState in an effect.
  const [state, setState] = useState<LoadState>(() =>
    token ? { phase: "loading" } : { phase: "invalid", message: "This invitation link is missing a token." },
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    invitationsApi.verify(token).then(
      (invitation) => {
        if (!cancelled) setState({ phase: "ready", invitation });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({
          phase: "invalid",
          message: error instanceof ApiError ? error.message : "This invitation link is invalid or has expired.",
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // The accept endpoint returns the same access/refresh token pair /auth/login/
      // does; invitationsApi.accept() stores them, so there's nothing further to do
      // here besides land on the dashboard.
      await invitationsApi.accept({ token, first_name: firstName, last_name: lastName, password });
      router.push("/");
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Couldn't complete registration — try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (state.phase === "loading") {
    return (
      <AuthCard title="Accept Invitation">
        <p className="text-center text-sm text-neutral-600">Checking your invitation…</p>
      </AuthCard>
    );
  }

  if (state.phase === "invalid") {
    return (
      <AuthCard title="Invitation Not Available">
        <p className="text-center text-sm text-neutral-600">{state.message}</p>
        <Link href="/login" className="mt-4 block text-center text-xs font-medium text-black underline underline-offset-2">
          Back to login
        </Link>
      </AuthCard>
    );
  }

  const { invitation } = state;
  const roleLabels = [
    invitation.is_global_admin && "Global Administration",
    invitation.is_content_manager && "Content Management",
    invitation.is_creator && "Creator",
  ].filter((label): label is string => Boolean(label));

  return (
    <AuthCard title="Join Your Workspace" maxWidth="xl">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="border border-black bg-neutral-50 p-3 text-sm">
          <p>
            You&apos;re joining <span className="font-semibold text-black">{invitation.organization_name}</span> as{" "}
            <span className="font-semibold text-black">{invitation.email}</span>.
          </p>
          {roleLabels.length > 0 && (
            <p className="mt-1 text-xs text-neutral-600">Assigned permissions: {roleLabels.join(", ")}</p>
          )}
        </div>

        {submitError && (
          <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="accept-first-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              First Name
            </label>
            <input
              id="accept-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="w-full border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <div>
            <label htmlFor="accept-last-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Last Name
            </label>
            <input
              id="accept-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="w-full border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        <div>
          <label htmlFor="accept-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Password *
          </label>
          <input
            id="accept-password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            className="w-full border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-black py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {isSubmitting ? "Joining…" : "Complete Registration"}
        </button>
      </form>
    </AuthCard>
  );
};
