"use client";

import { Ban, ListVideo, Users, X } from "lucide-react";

import type { ManagedShare } from "@/hooks/useShareManagement";
import { cn, formatRelativeTime } from "@/lib/utils";

type CapabilityKey = "canView" | "canEdit" | "canReorder" | "canReshare";
const CAPABILITY_PILLS: { key: CapabilityKey; apiField: "can_view" | "can_edit" | "can_reorder" | "can_reshare"; label: string }[] = [
  { key: "canView", apiField: "can_view", label: "View" },
  { key: "canEdit", apiField: "can_edit", label: "Edit Content" },
  { key: "canReorder", apiField: "can_reorder", label: "Reorder Playlist" },
  { key: "canReshare", apiField: "can_reshare", label: "Re-share" },
];

interface ShareAccessTableProps {
  shares: ManagedShare[];
  mutatingId: string | null;
  onToggleCapability: (share: ManagedShare, apiField: "can_view" | "can_edit" | "can_reorder" | "can_reshare", next: boolean) => void;
  onRevoke: (share: ManagedShare) => void;
}

export const ShareAccessTable = ({ shares, mutatingId, onToggleCapability, onRevoke }: ShareAccessTableProps) => {
  if (shares.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 border-2 border-black bg-white p-16 text-center">
        <Ban className="h-6 w-6 text-neutral-300" />
        <p className="text-sm font-medium text-neutral-600">No shares match these filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <table className="w-full min-w-[900px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-black bg-black text-white">
            <th className="px-3 py-2 font-mono uppercase tracking-wide">Recipient</th>
            <th className="px-3 py-2 font-mono uppercase tracking-wide">Resource</th>
            <th className="px-3 py-2 font-mono uppercase tracking-wide">Granted By</th>
            <th className="px-3 py-2 font-mono uppercase tracking-wide">Permissions</th>
            <th className="px-3 py-2 font-mono uppercase tracking-wide">Status</th>
            <th className="px-3 py-2 font-mono uppercase tracking-wide">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black">
          {shares.map((share) => {
            const isMutating = mutatingId === share.id;
            const isEditable = share.canManage && share.isActive && !isMutating;

            return (
              <tr key={share.id} className={cn(!share.isActive && "bg-neutral-50 text-neutral-400")}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {share.targetKind === "user" ? (
                      <span className="flex h-5 w-5 items-center justify-center border border-black bg-brand-yellow text-[10px] font-bold text-black">
                        {share.targetLabel.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <Users className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
                    )}
                    <span className="font-semibold text-black">{share.targetLabel}</span>
                    {share.targetKind !== "user" && (
                      <span className="border border-black px-1 font-mono text-[9px] uppercase text-neutral-500">
                        {share.targetKind}
                      </span>
                    )}
                  </div>
                  {share.parentShareId && (
                    <p className="mt-0.5 pl-6 text-[10px] text-neutral-400">delegated by {share.sharedByName}</p>
                  )}
                </td>

                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {share.contentThumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- arbitrary backend/external thumbnail
                      <img
                        src={share.contentThumbnailUrl}
                        alt=""
                        crossOrigin="anonymous"
                        className="h-8 w-12 shrink-0 border border-black object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-12 shrink-0 items-center justify-center border border-black bg-neutral-100">
                        <ListVideo className="h-3.5 w-3.5 text-neutral-400" />
                      </span>
                    )}
                    <span className="truncate font-medium text-black">{share.contentTitle}</span>
                  </div>
                </td>

                <td className="px-3 py-2.5 text-neutral-600">{share.sharedByName}</td>

                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {CAPABILITY_PILLS.map((pill) => {
                      const active = share[pill.key];
                      return (
                        <button
                          key={pill.key}
                          type="button"
                          disabled={!isEditable}
                          onClick={() => onToggleCapability(share, pill.apiField, !active)}
                          className={cn(
                            "border font-mono text-[11px] px-2 py-0.5 transition disabled:cursor-not-allowed",
                            active ? "border-black bg-brand-yellow text-black font-bold" : "border-black/30 text-neutral-400",
                            isEditable && "hover:border-black",
                          )}
                        >
                          [{active ? "✓" : " "}] {pill.label}
                        </button>
                      );
                    })}
                  </div>
                </td>

                <td className="px-3 py-2.5">
                  {share.isActive ? (
                    <span className="border border-emerald-600 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] text-emerald-700">
                      Active
                    </span>
                  ) : (
                    <span className="border border-neutral-400 bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-500">
                      Revoked {share.revokedAt ? formatRelativeTime(share.revokedAt) : ""}
                    </span>
                  )}
                </td>

                <td className="px-3 py-2.5">
                  {share.isActive && share.canManage && (
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => onRevoke(share)}
                      className="flex items-center gap-1 border border-black bg-rose-600 px-2 py-1 text-[11px] font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
