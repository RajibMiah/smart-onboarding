"use client";

import { CheckCircle2 } from "lucide-react";

import type { ProfileFormValues } from "@/hooks/useUserProfile";
import type { ApiTeam } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface AccountInfoFormProps {
  email: string;
  organisation: string;
  roleDescription: string;
  departmentName: string | null;
  teams: ApiTeam[];
  values: ProfileFormValues;
  setField: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onPrivacyPolicyClick: () => void;
}

export const AccountInfoForm = ({
  email,
  organisation,
  roleDescription,
  departmentName,
  teams,
  values,
  setField,
  isDirty,
  isSaving,
  onSave,
  onDiscard,
  onPrivacyPolicyClick,
}: AccountInfoFormProps) => {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Email Address" value={email} />
        <ReadOnlyField label="Organisation" value={organisation} />
      </div>

      <div>
        <p className="mb-4 text-sm font-bold text-black">{roleDescription}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="First Name" required value={values.firstName} onChange={(value) => setField("firstName", value)} />
          <TextField label="Last Name" required value={values.lastName} onChange={(value) => setField("lastName", value)} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField
            label="Location"
            required
            value={values.location}
            onChange={(value) => setField("location", value)}
            placeholder="e.g. Berlin, Germany"
          />
          <ReadOnlyField label="Department" value={departmentName ?? "Not assigned"} valid={Boolean(departmentName)} />
          <TeamSelectField
            value={values.teamId}
            teams={teams}
            onChange={(value) => setField("teamId", value)}
          />
        </div>

        <p className="mt-4 text-sm text-neutral-600">
          I accept the{" "}
          <button type="button" onClick={onPrivacyPolicyClick} className="font-semibold text-black underline underline-offset-2">
            APC privacy policy
          </button>
        </p>
      </div>

      {isDirty && (
        <div className="flex items-center justify-end gap-2 border border-black bg-brand-yellow/10 px-4 py-3">
          <span className="mr-auto text-sm text-neutral-700">You have unsaved changes.</span>
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="border border-black px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-neutral-100 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="border border-black bg-black px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
};

const ReadOnlyField = ({ label, value, valid }: { label: string; value: string; valid?: boolean }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
        {valid !== undefined && (
          <CheckCircle2 className={cn("h-3.5 w-3.5", valid ? "text-emerald-600" : "text-neutral-300")} />
        )}
      </span>
      <input
        type="text"
        value={value}
        disabled
        readOnly
        className="w-full cursor-not-allowed border border-black bg-neutral-100 px-3 py-2 text-sm text-neutral-600"
      />
    </label>
  );
};

const TextField = ({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label} {required && <span className="text-red-600">*</span>}
        {required && <CheckCircle2 className={cn("h-3.5 w-3.5", value ? "text-emerald-600" : "text-neutral-300")} />}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full border border-black px-3 py-2 text-sm text-black outline-none focus:ring-1 focus:ring-black"
      />
    </label>
  );
};

const TeamSelectField = ({
  value,
  teams,
  onChange,
}: {
  value: string;
  teams: ApiTeam[];
  onChange: (value: string) => void;
}) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Team <span className="text-red-600">*</span>
        <CheckCircle2 className={cn("h-3.5 w-3.5", value ? "text-emerald-600" : "text-neutral-300")} />
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-black bg-white px-3 py-2 text-sm text-black outline-none focus:ring-1 focus:ring-black"
      >
        <option value="">No team</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
};
