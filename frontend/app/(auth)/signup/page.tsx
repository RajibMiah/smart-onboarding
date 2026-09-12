"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { AuthCard } from "@/components/auth/AuthCard";
import { OtpInputGroup } from "@/components/auth/OtpInputGroup";
import { Toast } from "@/components/ui/Toast";
import { useAuthForm } from "@/hooks/useAuthForm";
import { useOtpVerification } from "@/hooks/useOtpVerification";
import { useToast } from "@/hooks/useToast";
import type { OtpPayload, WorkspaceRegistration } from "@/types/auth";

type SignupStep = "email" | "otp";

const OTP_LENGTH = 6;

export default function SignupPage() {
  const toast = useToast();
  const otp = useOtpVerification(OTP_LENGTH);
  const [step, setStep] = useState<SignupStep>("email");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const { values, errors, submitError, setField, handleSubmit } = useAuthForm<WorkspaceRegistration>({
    initialValues: { email: "", acceptedPrivacyPolicy: false },
    onSubmit: async () => {
      setIsSendingOtp(true);
      setTimeout(() => {
        setIsSendingOtp(false);
        setStep("otp");
        otp.reset();
        toast.show(`Verification code sent to ${values.email}.`);
      }, 900);
    },
  });

  function handleVerify() {
    if (!otp.isComplete || isVerifying) return;
    const payload: OtpPayload = { email: values.email, code: otp.code };
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      toast.show(`Workspace creation for ${payload.email} isn't available in this offline preview yet.`);
    }, 900);
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
            <label htmlFor="signup-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Email Address *
            </label>
            <div className="flex gap-2">
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
                className="min-w-0 flex-1 border border-black px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <button
                type="submit"
                disabled={isSendingOtp || !values.acceptedPrivacyPolicy}
                className="shrink-0 border border-black bg-brand-yellow px-5 py-2 text-sm font-bold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:border-black/20 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                {isSendingOtp ? "Sending…" : "Send OTP"}
              </button>
            </div>
            {errors.email && (
              <p id="signup-email-error" className="mt-1 text-xs text-red-600">
                {errors.email}
              </p>
            )}
          </div>

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
}
