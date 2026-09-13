"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Trash2, UserPlus, X } from "lucide-react";

import { INVITE_USER_MODAL_ID, InviteUserModal } from "@/components/admin/InviteUserModal";
import { Toast } from "@/components/ui/Toast";
import { useModal } from "@/hooks/useModal";
import { useToast } from "@/hooks/useToast";
import {
  invitationsApi,
  usersApi,
  ApiError,
  type ApiOrgUser,
  type ApiWorkspaceInvitation,
} from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

const ManageUsersPage = () => {
  const toast = useToast();
  const inviteModal = useModal(INVITE_USER_MODAL_ID);
  const [users, setUsers] = useState<ApiOrgUser[]>([]);
  const [invitations, setInvitations] = useState<ApiWorkspaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [userPage, invitationPage] = await Promise.all([usersApi.list(), invitationsApi.list()]);
      setUsers(userPage.results);
      setInvitations(invitationPage.results.filter((invitation) => invitation.status === "pending"));
    } catch {
      toast.show("Couldn't load users — try refreshing.");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([usersApi.list(), invitationsApi.list()]).then(
      ([userPage, invitationPage]) => {
        if (cancelled) return;
        setUsers(userPage.results);
        setInvitations(invitationPage.results.filter((invitation) => invitation.status === "pending"));
        setIsLoading(false);
      },
      () => {
        if (cancelled) return;
        toast.show("Couldn't load users — try refreshing.");
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load; `refresh` handles later reloads
  }, []);

  const handleRevoke = useCallback(
    async (id: string) => {
      const previous = invitations;
      setInvitations((prev) => prev.filter((invitation) => invitation.id !== id));
      try {
        await invitationsApi.revoke(id);
      } catch (error) {
        toast.show(error instanceof ApiError ? error.message : "Couldn't revoke that invitation.");
        setInvitations(previous);
      }
    },
    [invitations, toast],
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black">All Users</h1>
          <p className="text-sm text-neutral-500">Manage who has access to this workspace.</p>
        </div>
        <button
          type="button"
          title="Add new user to this workspace"
          onClick={inviteModal.open}
          className="flex items-center gap-2 border border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          <UserPlus className="h-4 w-4" /> Invite User
        </button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">Members ({users.length})</h2>
        <div className="overflow-x-auto border border-black">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Email Address</th>
                <th className="px-3 py-2">Organizational Levels</th>
                <th className="px-3 py-2 text-center">Authorized</th>
                <th className="px-3 py-2 text-center">Creator</th>
                <th className="px-3 py-2 text-center">Global Admin</th>
                <th className="px-3 py-2 text-center">Content Mgmt</th>
                <th className="px-3 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                    No members yet.
                  </td>
                </tr>
              ) : (
                users.map((member) => (
                  <tr key={member.id} className="border-b border-black/10 last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium text-black">{member.full_name || member.email}</div>
                      <div className="text-xs text-neutral-500">{member.email}</div>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {[member.department, member.team].filter(Boolean).join(": ") || "—"}
                    </td>
                    <FlagCell checked={member.membership?.is_authorized ?? false} />
                    <FlagCell checked={member.membership?.is_creator ?? false} />
                    <FlagCell checked={member.membership?.is_global_admin ?? false} />
                    <FlagCell checked={member.membership?.is_content_manager ?? false} />
                    <td className="px-3 py-2 text-neutral-500">{formatRelativeTime(member.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {invitations.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">
            Pending Invitations ({invitations.length})
          </h2>
          <div className="flex flex-col gap-2">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-black px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-black">{invitation.email}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    Sent {formatRelativeTime(invitation.created_at)} · Expires{" "}
                    {new Date(invitation.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevoke(invitation.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Revoke
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <InviteUserModal onInvited={() => void refresh()} />
      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};
export default ManageUsersPage;

const FlagCell = ({ checked }: { checked: boolean }) => {
  return (
    <td className="px-3 py-2 text-center">
      {checked ? <Check className="mx-auto h-4 w-4 text-black" /> : <X className="mx-auto h-4 w-4 text-neutral-300" />}
    </td>
  );
};
