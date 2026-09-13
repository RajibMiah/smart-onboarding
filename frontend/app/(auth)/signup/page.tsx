"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { AuthCard } from "@/components/auth/AuthCard";
import { OtpInputGroup } from "@/components/auth/OtpInputGroup";
import { Toast } from "@/components/ui/Toast";
import { useAuthForm } from "@/hooks/useAuthForm";
import { useOtpVerification } from "@/hooks/useOtpVerification";
import { useToast } from "@/hooks/useToast";
import { authApi, ApiError } from "@/lib/api-client";
import type { WorkspaceRegistration } from "@/types/auth";

type SignupStep = "email" | "otp";

const OTP_LENGTH = 6;

const SignupPage = () => {
  const router = useRouter();
  const toast = useToast();
  const otp = useOtpVerification(OTP_LENGTH);
  const [step, setStep] = useState<SignupStep>("email");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const { values, errors, submitError, setField, handleSubmit } = useAuthForm<WorkspaceRegistration>({
    initialValues: { email: "", password: "", organizationName: "", acceptedPrivacyPolicy: false },
    onSubmit: async () => {
      setIsSendingOtp(true);
      try {
        // The account is created here for real; the OTP step below is a
        // client-side confirmation gate (there's no email-delivery backend
        // yet), so login happens once that gate is cleared.
        await authApi.register({
          email: values.email,
          password: values.password,
          organization_name: values.organizationName,
        });
        setStep("otp");
        otp.reset();
        toast.show(`Verification code sent to ${values.email}.`);
      } catch (error) {
        toast.show(error instanceof ApiError ? error.message : "Couldn't create your workspace — try again.");
      } finally {
        setIsSendingOtp(false);
      }
    },
  });

  async function handleVerify() {
    if (!otp.isComplete || isVerifying) return;
    setIsVerifying(true);
    try {
      await authApi.login({ email: values.email, password: values.password });
      router.push("/");
    } catch {
      toast.show("Couldn't sign you in automatically — please log in.");
      router.push("/login");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <AuthCard title="Create a new workspace" maxWidth="xl">
      {step === "email" ? (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {submitError && (
            <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div>
            <label htmlFor="signup-org" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Workspace Name *
            </label>
            <input
              id="signup-org"
              type="text"
              required
              placeholder="Acme Onboarding"
              value={values.organizationName}
              onChange={(event) => setField("organizationName", event.target.value)}
              className="w-full border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label htmlFor="signup-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Email Address *
            </label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              placeholder="user@example.com"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              className="w-full border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
            {errors.email && (
              <p id="signup-email-error" className="mt-1 text-xs text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="signup-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Password *
            </label>
            <input
              id="signup-password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={values.password}
              onChange={(event) => setField("password", event.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "signup-password-error" : undefined}
              className="w-full border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
            {errors.password && (
              <p id="signup-password-error" className="mt-1 text-xs text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSendingOtp || !values.acceptedPrivacyPolicy || !values.organizationName.trim()}
            className="w-full border border-black bg-brand-yellow px-5 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:border-black/20 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            {isSendingOtp ? "Creating workspace…" : "Send OTP"}
          </button>

          <label className="flex items-start gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={values.acceptedPrivacyPolicy}
              onChange={(event) => setField("acceptedPrivacyPolicy", event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              I accept the{" "}
              <a href="#" className="font-medium text-black underline underline-offset-2">
                APC privacy policy
              </a>
            </span>
          </label>

          <p className="text-center text-xs text-neutral-500">
            Already have a workspace?{" "}
            <Link href="/login" className="font-medium text-black underline underline-offset-2">
              Log in
            </Link>
            {" · "}
            Got an invitation email? Use the link in it.
          </p>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <p className="text-center text-sm text-neutral-600">
            Enter the 6-digit code sent to <span className="font-semibold text-black">{values.email}</span>
          </p>

          <OtpInputGroup
            length={OTP_LENGTH}
            digits={otp.digits}
            registerInputRef={otp.registerInputRef}
            onChange={otp.handleChange}
            onKeyDown={otp.handleKeyDown}
            onPaste={otp.handlePaste}
            disabled={isVerifying}
          />

          <button
            type="button"
            onClick={otp.resend}
            disabled={!otp.canResend}
            className="text-xs font-medium text-neutral-500 transition hover:text-black disabled:cursor-not-allowed disabled:hover:text-neutral-500"
          >
            {otp.canResend ? "Resend OTP" : `Resend code in ${otp.formattedCountdown}`}
          </button>

          <button
            type="button"
            onClick={handleVerify}
            disabled={!otp.isComplete || isVerifying}
            className="flex w-full items-center justify-center gap-2 bg-black py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            {isVerifying ? "Verifying…" : "Verify & Create Workspace"}
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setStep("email")}
            className="text-xs font-medium text-neutral-500 underline-offset-2 hover:underline"
          >
            Use a different email
          </button>
        </div>
      )}

      {toast.message && <Toast message={toast.message} />}
    </AuthCard>
  );
};
export default SignupPage;
