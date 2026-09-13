"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";
import { useInviteUser } from "@/hooks/useInviteUser";
import { useModal } from "@/hooks/useModal";

export const INVITE_USER_MODAL_ID = "invite-user";

interface InviteUserModalProps {
  onInvited?: () => void;
}

const InviteUserModalImpl = ({ onInvited }: InviteUserModalProps) => {
  const { isOpen, close } = useModal(INVITE_USER_MODAL_ID);
  const { values, setField, addTag, removeTag, departments, teams, isSubmitting, error, submit } = useInviteUser({
    isActive: isOpen,
    onInvited,
  });
  const [tagDraft, setTagDraft] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = await submit();
    if (ok) close();
  }

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagDraft);
      setTagDraft("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" onClick={close} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-user-title"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col border border-black bg-white shadow-popover animate-modal-in"
      >
        <div className="border-b border-black px-5 pb-3 pt-5">
          <div className="flex items-center justify-between">
            <h2 id="invite-user-title" className="text-lg font-bold text-black">
              Invite New Member to Workspace
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="p-1 text-black transition hover:bg-neutral-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Only email addresses not currently enrolled in this APC workspace can be invited.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto p-5">
          {error && (
            <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="invite-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              autoFocus
              required
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              placeholder="teammate@company.com"
              className="w-full rounded-none border border-black p-2.5 font-mono text-sm focus:border-black focus:outline-none focus:ring-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="invite-department" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Department
              </label>
              <select
                id="invite-department"
                value={values.departmentId}
                onChange={(event) => setField("departmentId", event.target.value)}
                className="w-full rounded-none border border-black p-2.5 text-sm focus:border-black focus:outline-none focus:ring-0"
              >
                <option value="">No department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="invite-team" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Team
              </label>
              <select
                id="invite-team"
                value={values.teamId}
                onChange={(event) => setField("teamId", event.target.value)}
                className="w-full rounded-none border border-black p-2.5 text-sm focus:border-black focus:outline-none focus:ring-0"
              >
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="flex flex-col gap-2 border border-black p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Role &amp; Permission Flags
            </legend>
            <PermissionCheckbox
              label="Authorized"
              description="Grant platform access upon registration"
              checked={values.isAuthorized}
              onChange={(checked) => setField("isAuthorized", checked)}
            />
            <PermissionCheckbox
              label="Creator"
              description="Can record, upload clips, and generate AI tutorials"
              checked={values.isCreator}
              onChange={(checked) => setField("isCreator", checked)}
            />
            <PermissionCheckbox
              label="Content Management"
              description="Can review, publish, and curate playlists"
              checked={values.isContentManager}
              onChange={(checked) => setField("isContentManager", checked)}
            />
            <PermissionCheckbox
              label="Global Administration"
              description="Full organizational control and user management"
              checked={values.isGlobalAdmin}
              onChange={(checked) => setField("isGlobalAdmin", checked)}
            />
          </fieldset>

          <div>
            <label htmlFor="invite-tags" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Organizational Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 border border-black p-2">
              {values.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 border border-black bg-brand-yellow px-2 py-0.5 text-xs font-semibold text-black"
                >
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} className="hover:text-red-700">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="invite-tags"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Engineering, QA, External Contractor…"
                className="min-w-[8rem] flex-1 border-none p-1 text-sm focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-black pt-4">
            <button
              type="button"
              onClick={close}
              className="border border-black px-4 py-2 text-xs font-bold transition hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !values.email.trim()}
              className="border border-black bg-yellow-400 px-5 py-2 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-yellow-500 disabled:opacity-50"
            >
              {isSubmitting ? "Sending…" : "Send Invitation Link ➔"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PermissionCheckbox = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-black"
      />
      <span>
        <span className="font-semibold text-black">{label}</span>
        <span className="block text-xs text-neutral-500">{description}</span>
      </span>
    </label>
  );
};

export const InviteUserModal = withPortal(InviteUserModalImpl);
