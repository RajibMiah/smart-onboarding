"use client";

import { ChevronDown } from "lucide-react";

interface OAuthButtonsProps {
  onNotify: (message: string) => void;
}

/** Microsoft SSO trigger + a mocked "continue as" Google account badge — both stubs, no OAuth backend yet. */
export const OAuthButtons = ({ onNotify }: OAuthButtonsProps) => {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onNotify("Microsoft sign-in isn't available in this offline preview yet.")}
        className="flex w-full items-center justify-center gap-2 border border-black py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-50"
      >
        <MicrosoftIcon className="h-4 w-4" />
        Sign in with Microsoft
      </button>

      <button
        type="button"
        onClick={() => onNotify("Google sign-in isn't available in this offline preview yet.")}
        aria-label="Continue with Google as you@example.com"
        className="flex w-full items-center gap-3 border border-black p-2.5 text-left transition hover:bg-neutral-50"
      >
        <GoogleIcon className="h-4 w-4 shrink-0" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
          Y
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-black">you@example.com</span>
          <span className="block text-xs text-neutral-500">Continue with Google</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>
    </div>
  );
};

const MicrosoftIcon = ({ className }: { className?: string }) => {
  return (
    <svg viewBox="0 0 21 21" className={className} aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
};

const GoogleIcon = ({ className }: { className?: string }) => {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.42 3.58v3h3.91c2.29-2.11 3.53-5.22 3.53-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.91-3c-1.08.73-2.47 1.16-4.02 1.16-3.1 0-5.72-2.09-6.66-4.9H1.28v3.09C3.25 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.34 14.35A7.2 7.2 0 015 12c0-.82.14-1.61.34-2.35V6.56H1.28A12 12 0 000 12c0 1.93.46 3.76 1.28 5.44l4.06-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.56l4.06 3.09C6.28 6.84 8.9 4.75 12 4.75z" />
    </svg>
  );
};
