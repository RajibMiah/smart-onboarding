"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";
import { departmentsApi, ApiError, CUSTOM_ROLE_CAPABILITY_FLAGS, type ApiDepartment, type CustomRolePayload } from "@/lib/api-client";
import { CAPABILITY_FLAG_LABELS } from "@/types/roles";

interface CreateCustomRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CustomRolePayload) => Promise<unknown>;
}

const emptyFlags = Object.fromEntries(CUSTOM_ROLE_CAPABILITY_FLAGS.map((flag) => [flag, false])) as Record<
  (typeof CUSTOM_ROLE_CAPABILITY_FLAGS)[number],
  boolean
>;

function CreateCustomRoleModalImpl({ isOpen, onClose, onCreate }: CreateCustomRoleModalProps) {
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [flags, setFlags] = useState(emptyFlags);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    departmentsApi.list().then((page) => setDepartments(page.results), () => undefined);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setDescription("");
    setDepartmentId("");
    setFlags(emptyFlags);
    setError(null);
  }, [isOpen]);

  const toggleFlag = (flag: keyof typeof flags) => {
    setFlags((prev) => ({ ...prev, [flag]: !prev[flag] }));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Give this role a name.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        description,
        department: departmentId || null,
        ...flags,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this role — please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-role-title"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col border border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-modal-in"
      >
        <div className="flex items-start justify-between gap-3 border-b border-black p-5">
          <h2 id="create-role-title" className="text-base font-bold text-black">
            Create Custom Role
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-black transition hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Role / Job Title Name</p>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. HR Compliance Specialist"
            className="mb-4 w-full border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</p>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="What this role is responsible for."
            className="mb-4 w-full resize-none border border-black p-3 text-sm focus:outline-none focus:ring-0"
          />

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Restrict to a department (optional)
          </p>
          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            aria-label="Restrict to department"
            className="mb-4 w-full border border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="">No restriction — applies workspace-wide</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Permissions</p>
          <div className="grid grid-cols-1 gap-2 border border-black p-3 sm:grid-cols-2">
            {CUSTOM_ROLE_CAPABILITY_FLAGS.map((flag) => (
              <label key={flag} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={flags[flag]}
                  onChange={() => toggleFlag(flag)}
                  className="h-3.5 w-3.5 accent-black"
                />
                {CAPABILITY_FLAG_LABELS[flag]}
              </label>
            ))}
          </div>

          {error && (
            <div role="alert" className="mt-3 border border-red-600 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-black p-4">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className="w-full border border-black bg-brand-yellow px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Creating…" : "Create Role Entity ➔"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const CreateCustomRoleModal = withPortal(CreateCustomRoleModalImpl);
