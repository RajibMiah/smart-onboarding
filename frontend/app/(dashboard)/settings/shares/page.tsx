"use client";

import { useMemo, useState } from "react";

import { RevokeConfirmationModal } from "@/components/sharing/RevokeConfirmationModal";
import { ShareAccessTable } from "@/components/sharing/ShareAccessTable";
import { EditorialFilterBar } from "@/components/ui/EditorialFilterBar";
import { Toast } from "@/components/ui/Toast";
import { useShareManagement, type ManagedShare } from "@/hooks/useShareManagement";
import { useToast } from "@/hooks/useToast";

const SCOPE_OPTIONS = [
  { value: "all", label: "All Active Shares" },
  { value: "shared_by_me", label: "Shared by Me" },
  { value: "shared_with_me", label: "Shared with Me" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "all", label: "All (incl. Revoked)" },
  { value: "revoked", label: "Revoked / Inactive" },
];

const TARGET_OPTIONS = [
  { value: "all", label: "Any Target" },
  { value: "user", label: "Individual Users" },
  { value: "team", label: "Teams" },
  { value: "department", label: "Departments" },
];

const RESOURCE_OPTIONS = [
  { value: "all", label: "Playlists & Clips" },
  { value: "playlist", label: "Playlists" },
  { value: "clip", label: "Clips" },
];

/** Walks `parentShareId` links in the already-fetched list to find every
 *  share transitively delegated off `root` — shown in the revoke
 *  confirmation so a cascade's blast radius is visible before confirming. */
const downstreamOf = (root: ManagedShare, all: ManagedShare[]): ManagedShare[] => {
  const result: ManagedShare[] = [];
  const frontier = [root.id];
  while (frontier.length > 0) {
    const currentId = frontier.pop();
    const children = all.filter((share) => share.parentShareId === currentId && share.isActive);
    result.push(...children);
    frontier.push(...children.map((child) => child.id));
  }
  return result;
};

const SharesManagementPage = () => {
  const toast = useToast();
  const {
    shares,
    isLoading,
    error,
    mutatingId,
    scope,
    setScope,
    status,
    setStatus,
    resourceType,
    setResourceType,
    targetType,
    setTargetType,
    search,
    setSearch,
    updateCapabilities,
    revokeShare,
    totalActive,
    totalDelegated,
  } = useShareManagement();

  const [revokeTarget, setRevokeTarget] = useState<ManagedShare | null>(null);

  const downstreamRecipients = useMemo(
    () => (revokeTarget ? downstreamOf(revokeTarget, shares).map((share) => share.targetLabel) : []),
    [revokeTarget, shares],
  );

  const handleToggleCapability = (
    share: ManagedShare,
    apiField: "can_view" | "can_edit" | "can_reorder" | "can_reshare",
    next: boolean,
  ) => {
    void updateCapabilities(share.id, { [apiField]: next }).catch(() =>
      toast.show("Couldn't update that permission — please try again."),
    );
  };

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return;
    void revokeShare(revokeTarget.id)
      .then(() => toast.show("Access revoked."))
      .catch(() => toast.show("Couldn't revoke access — please try again."))
      .finally(() => setRevokeTarget(null));
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-black">Access &amp; Share Delegation Matrix</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Total Active Shares: <span className="font-mono font-semibold text-black">{totalActive}</span> · Downstream
          Delegates: <span className="font-mono font-semibold text-black">{totalDelegated}</span>
        </p>
      </div>

      <EditorialFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, or title..."
        selects={[
          { id: "scope", label: "Scope", value: scope, options: SCOPE_OPTIONS, onChange: (v) => setScope(v as typeof scope) },
          { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, onChange: (v) => setStatus(v as typeof status) },
          {
            id: "target",
            label: "Target Type",
            value: targetType,
            options: TARGET_OPTIONS,
            onChange: (v) => setTargetType(v as typeof targetType),
          },
          {
            id: "resource",
            label: "Resource Type",
            value: resourceType,
            options: RESOURCE_OPTIONS,
            onChange: (v) => setResourceType(v as typeof resourceType),
          },
        ]}
      />

      {error && (
        <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="text-xs text-neutral-500">{isLoading ? "Loading shares…" : `${shares.length} share${shares.length === 1 ? "" : "s"}`}</p>

      <ShareAccessTable
        shares={shares}
        mutatingId={mutatingId}
        onToggleCapability={handleToggleCapability}
        onRevoke={setRevokeTarget}
      />

      <RevokeConfirmationModal
        isOpen={revokeTarget !== null}
        isRevoking={mutatingId === revokeTarget?.id}
        recipientLabel={revokeTarget?.targetLabel ?? ""}
        contentTitle={revokeTarget?.contentTitle ?? ""}
        downstreamRecipients={downstreamRecipients}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
      />

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};
export default SharesManagementPage;
