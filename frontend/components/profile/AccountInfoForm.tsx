"use client";

import { CheckCircle2 } from "lucide-react";

import type { ProfileFormValues } from "@/hooks/useProfileForm";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

const LOCATION_OPTIONS: SelectOption[] = [{ value: "my-location", label: "My Location" }];
const DEPARTMENT_OPTIONS: SelectOption[] = [{ value: "my-department", label: "My Department" }];
const TEAM_OPTIONS: SelectOption[] = [{ value: "my-team", label: "My Team" }];

interface AccountInfoFormProps {
  email: string;
  organisation: string;
  role: string;
  values: ProfileFormValues;
  setField: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onPrivacyPolicyClick: () => void;
}

export function AccountInfoForm({
  email,
  organisation,
  role,
  values,
  setField,
  isDirty,
  isSaving,
  onSave,
  onDiscard,
  onPrivacyPolicyClick,
}: AccountInfoFormProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Email Address" value={email} />
        <ReadOnlyField label="Organisation" value={organisation} />
      </div>

      <div>
        <p className="mb-4 text-sm font-semibold text-apc-900">{role}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="First Name"
            required
            value={values.firstName}
            onChange={(value) => setField("firstName", value)}
          />
          <TextField
            label="Last Name"
            required
            value={values.lastName}
            onChange={(value) => setField("lastName", value)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Location"
            required
            value={values.location}
            options={LOCATION_OPTIONS}
            onChange={(value) => setField("location", value)}
          />
          <SelectField
            label="Department"
            required
            value={values.department}
            options={DEPARTMENT_OPTIONS}
            onChange={(value) => setField("department", value)}
          />
          <SelectField
            label="Team"
            required
            value={values.team}
            options={TEAM_OPTIONS}
            onChange={(value) => setField("team", value)}
          />
        </div>

        <p className="mt-4 text-sm text-slate-600">
          I accept the{" "}
          <button
            type="button"
            onClick={onPrivacyPolicyClick}
            className="font-medium text-apc-900 underline underline-offset-2 hover:text-apc-800"
          >
            APC privacy policy
          </button>
        </p>
      </div>

      {isDirty && (
        <div className="flex items-center justify-end gap-2 rounded-lg border border-apc-accent/30 bg-apc-accent/5 px-4 py-3">
          <span className="mr-auto text-sm text-slate-600">You have unsaved changes.</span>
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-lg bg-apc-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-apc-800 disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="text"
        value={value}
        disabled
        readOnly
        className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-apc-accent focus:ring-2 focus:ring-apc-accent/20"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const isValid = options.some((option) => option.value === value);

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-apc-accent focus:ring-2 focus:ring-apc-accent/20"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <CheckCircle2
          className={cn("h-5 w-5 shrink-0", isValid ? "text-emerald-500" : "text-slate-300")}
          aria-label={isValid ? `${label} confirmed` : `${label} not set`}
        />
      </div>
    </label>
  );
}
