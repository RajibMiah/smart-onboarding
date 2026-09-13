"use client";

import type { ClipboardEvent, KeyboardEvent } from "react";

interface OtpInputGroupProps {
  length: number;
  digits: string[];
  registerInputRef: (index: number) => (el: HTMLInputElement | null) => void;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

/** Controlled, presentational 6-box code input — all state/focus logic lives in `useOtpVerification`. */
export const OtpInputGroup = ({ length, digits, registerInputRef, onChange, onKeyDown, onPaste, disabled }: OtpInputGroupProps) => {
  return (
    <div role="group" aria-label="One-time verification code" className="flex justify-center gap-2">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={registerInputRef(index)}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digits[index] ?? ""}
          disabled={disabled}
          onChange={(event) => onChange(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          aria-label={`Digit ${index + 1} of ${length}`}
          className="h-14 w-12 border border-black text-center text-xl font-mono font-bold focus:bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        />
      ))}
    </div>
  );
};
