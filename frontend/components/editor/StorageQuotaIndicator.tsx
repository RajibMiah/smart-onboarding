"use client";

import { AlertTriangle, Check, CloudOff, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SaveStatus, StorageQuotaEstimate } from "@/types/storage";

interface StorageQuotaIndicatorProps {
  saveStatus: SaveStatus;
  quota: StorageQuotaEstimate | null;
  errorMessage?: string | null;
}

const QUOTA_WARNING_THRESHOLD_PERCENT = 80;

function formatBytesShort(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Compact editorial badge: local auto-save status, plus a disk-quota warning once usage runs high. */
export function StorageQuotaIndicator({ saveStatus, quota, errorMessage }: StorageQuotaIndicatorProps) {
  const isQuotaHigh = (quota?.percentUsed ?? 0) >= QUOTA_WARNING_THRESHOLD_PERCENT;

  return (
    <div className="flex items-center gap-2 text-xs">
      <SaveStatusPill status={saveStatus} errorMessage={errorMessage} />

      {quota && quota.quota > 0 && (
        <span
          title={`${formatBytesShort(quota.usage)} of ${formatBytesShort(quota.quota)} used on this device`}
          className={cn(
            "flex items-center gap-1 border px-2 py-1 font-semibold",
            isQuotaHigh ? "border-red-600 bg-red-50 text-red-700" : "border-black/20 text-neutral-500",
          )}
        >
          {isQuotaHigh && <AlertTriangle className="h-3 w-3" />}
          {quota.percentUsed}% local storage used
        </span>
      )}
    </div>
  );
}

function SaveStatusPill({ status, errorMessage }: { status: SaveStatus; errorMessage?: string | null }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 border border-black/20 px-2 py-1 font-semibold text-neutral-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 border border-black/20 px-2 py-1 font-semibold text-neutral-500">
        <Check className="h-3 w-3" /> Saved locally
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        title={errorMessage ?? undefined}
        className="flex items-center gap-1 border border-red-600 bg-red-50 px-2 py-1 font-semibold text-red-700"
      >
        <CloudOff className="h-3 w-3" /> {errorMessage ?? "Save failed"}
      </span>
    );
  }

  return null;
}
