"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";
import { ApiError, type ApiCustomRole, type ApiOrgUser, type ApiSystemRoleTier } from "@/lib/api-client";
import { ASSIGNABLE_ROLE_TIERS, SYSTEM_ROLE_LABELS } from "@/types/roles";

interface MemberDetailDrawerProps {
  member: ApiOrgUser | null;
  customRoles: ApiCustomRole[];
  onClose: () => void;
  onUpdateRole: (userId: string, payload: { role_tier?: ApiSystemRoleTier; custom_role?: string | null }) => Promise<unknown>;
  onRevoke: (userId: string) => Promise<unknown>;
  onReactivate: (userId: string) => Promise<unknown>;
}

const NONE_CUSTOM_ROLE = "__none__";

function MemberDetailDrawerImpl({ member, customRoles, onClose, onUpdateRole, onRevoke, onReactivate }: MemberDetailDrawerProps) {
  const [roleTier, setRoleTier] = useState<ApiSystemRoleTier>("creator");
  const [customRoleId, setCustomRoleId] = useState(NONE_CUSTOM_ROLE);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingRevoke, setIsConfirmingRevoke] = useState(false);

  useEffect(() => {
    if (!member) return;
    setRoleTier(member.membership?.role_tier ?? "creator");
    setCustomRoleId(member.membership?.custom_role ?? NONE_CUSTOM_ROLE);
    setError(null);
    setIsConfirmingRevoke(false);
  }, [member]);

  if (!member) return null;

  const isActive = member.membership?.is_authorized ?? false;
  const isOwner = member.membership?.role_tier === "owner";

  const handleSaveRole = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onUpdateRole(member.id, {
        role_tier: roleTier,
        custom_role: customRoleId === NONE_CUSTOM_ROLE ? null : customRoleId,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update this member's role.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onRevoke(member.id);
      setIsConfirmingRevoke(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke this member's access.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReactivate = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onReactivate(member.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reactivate this member.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-drawer-title"
        className="relative flex h-full w-full max-w-md flex-col border-l border-black bg-white shadow-[-4px_0px_0px_0px_rgba(0,0,0,1)] animate-modal-in"
      >
        <div className="flex items-start justify-between gap-3 border-b border-black p-5">
          <div>
            <h2 id="member-drawer-title" className="text-base font-bold text-black">
              {member.full_name || member.email}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">{member.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-black transition hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-center gap-2">
            <span
              className={
                isActive
                  ? "border border-black bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-black"
                  : "border border-black bg-red-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-red-700"
              }
            >
              {isActive ? "Active" : "Revoked"}
            </span>
            {member.membership?.revoked_at && (
              <span className="text-[11px] text-neutral-400">
                Revoked {new Date(member.membership.revoked_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <dl className="mb-5 grid grid-cols-2 gap-3 border border-black p-3 text-xs">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-neutral-500">Department</dt>
              <dd className="mt-0.5 text-black">{member.department ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-neutral-500">Team</dt>
              <dd className="mt-0.5 text-black">{member.team ?? "—"}</dd>
            </div>
          </dl>

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Standard Role</p>
          <select
            value={roleTier}
            onChange={(event) => setRoleTier(event.target.value as ApiSystemRoleTier)}
            disabled={isOwner}
            aria-label="Standard role"
            className="mb-4 w-full border border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            {isOwner && <option value="owner">{SYSTEM_ROLE_LABELS.owner}</option>}
            {ASSIGNABLE_ROLE_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {SYSTEM_ROLE_LABELS[tier]}
              </option>
            ))}
          </select>

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Custom Role (optional)</p>
          <select
            value={customRoleId}
            onChange={(event) => setCustomRoleId(event.target.value)}
            disabled={isOwner}
            aria-label="Custom role"
            className="mb-4 w-full border border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            <option value={NONE_CUSTOM_ROLE}>None</option>
            {customRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void handleSaveRole()}
            disabled={isSaving || isOwner}
            className="mb-6 w-full border border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save Role Changes"}
          </button>

          {error && (
            <div role="alert" className="mb-4 border border-red-600 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {!isOwner && (
            <div className="border border-red-600 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-xs font-bold uppercase tracking-wide">Danger Zone</p>
              </div>

              {isActive ? (
                isConfirmingRevoke ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-neutral-700">
                      This immediately blocks every future request from this account and blacklists their active
                      sessions. Their clips, comments, and edits stay attributed and untouched.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsConfirmingRevoke(false)}
                        className="flex-1 border border-black px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-neutral-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRevoke()}
                        disabled={isSaving}
                        className="flex-1 border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving ? "Revoking…" : "Confirm Revoke"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingRevoke(true)}
                    className="w-full border border-red-600 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
                  >
                    ✕ Revoke Workspace Access
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => void handleReactivate()}
                  disabled={isSaving}
                  className="w-full border border-black bg-brand-yellow px-3 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Reactivating…" : "Reactivate Access"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const MemberDetailDrawer = withPortal(MemberDetailDrawerImpl);
