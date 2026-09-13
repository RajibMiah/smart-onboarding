"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Inbox, MessageSquare } from "lucide-react";

import { Toast } from "@/components/ui/Toast";
import { useMediaRequests, type RequestInboxScope } from "@/hooks/useMediaRequests";
import { useToast } from "@/hooks/useToast";
import {
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  type MediaShareRequest,
  type RequestPriority,
  type RequestStatus,
} from "@/types/sharing";
import { cn } from "@/lib/utils";

const TABS: { id: RequestInboxScope; label: string }[] = [
  { id: "assigned_to_me", label: "Assigned to Me" },
  { id: "created_by_me", label: "Created by Me" },
  { id: "archived", label: "Archived / Completed" },
];

const STATUS_OPTIONS: RequestStatus[] = ["pending", "approved", "changes_requested", "completed", "canceled"];
const PRIORITY_OPTIONS: RequestPriority[] = ["low", "medium", "high", "urgent"];

const PRIORITY_DOT: Record<RequestPriority, string> = {
  low: "bg-neutral-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-600",
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "border-black bg-white text-black",
  approved: "border-black bg-emerald-100 text-black",
  changes_requested: "border-black bg-red-100 text-black",
  completed: "border-black bg-neutral-200 text-black",
  canceled: "border-black bg-neutral-200 text-neutral-500",
};

const formatDueDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const due = new Date(iso);
  const diffMs = due.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`;
  if (diffDays === 0) return "Due today";
  return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
};

const targetLabel = (request: MediaShareRequest): string => {
  if (request.targetDepartmentName) return `Department: ${request.targetDepartmentName}`;
  if (request.targetTeamName) return `Team: ${request.targetTeamName}`;
  if (request.targetUserName) return `User: ${request.targetUserName}`;
  return "Unassigned";
};

const RequestsPage = () => {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<RequestInboxScope>("assigned_to_me");
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | RequestPriority>("all");

  const filters = useMemo(() => {
    const next: Record<string, string> = {};
    if (statusFilter !== "all") next.status = statusFilter;
    if (priorityFilter !== "all") next.priority = priorityFilter;
    return next;
  }, [statusFilter, priorityFilter]);

  const { requests, isLoading, error, resolveRequest } = useMediaRequests(activeTab, filters);

  const openReview = (request: MediaShareRequest) => {
    // The Review page has no deep-link support of its own — it only reads
    // from the Studio session's already-hydrated EditorContext state (set by
    // navigating through Studio first, or by useReviewWorkflow's own
    // resume-by-id effect). Routing straight to `/studio/review` here would
    // land on an empty page, so this goes through the same `?clip=` resume
    // entry point the Library already uses.
    if (request.contentType === "clip") {
      router.push(`/studio?clip=${request.objectId}`);
    } else {
      router.push(`/library/playlists/${request.objectId}`);
    }
  };

  const handleAction = async (request: MediaShareRequest, action: "approve" | "request_changes" | "complete") => {
    try {
      await resolveRequest(request.id, action);
      toast.show(action === "approve" ? "✓ Request approved" : action === "complete" ? "✓ Marked complete" : "Changes requested");
    } catch {
      toast.show("Couldn't update that request — please try again.");
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight text-black">Requests</h1>

      <div className="flex border border-black">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 border-r border-black px-3 py-2 text-xs font-semibold uppercase tracking-wide last:border-r-0",
              activeTab === tab.id ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | RequestStatus)}
          aria-label="Filter by status"
          className="border border-black bg-white px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {REQUEST_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as "all" | RequestPriority)}
          aria-label="Filter by priority"
          className="border border-black bg-white px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black"
        >
          <option value="all">All priorities</option>
          {PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {REQUEST_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="text-xs text-neutral-500">{isLoading ? "Loading requests…" : `${requests.length} request${requests.length === 1 ? "" : "s"}`}</p>

      {!isLoading && requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-black p-16 text-center">
          <Inbox className="h-6 w-6 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-600">No requests here</p>
          <p className="text-xs text-neutral-400">
            Share a clip or playlist with "Send with Request" to ask a teammate for feedback or approval.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => {
            const dueLabel = formatDueDate(request.dueDate);
            return (
              <div key={request.id} className="flex gap-3 border border-black bg-white p-3">
                <button
                  type="button"
                  onClick={() => openReview(request)}
                  className="h-20 w-32 shrink-0 overflow-hidden border border-black bg-neutral-100"
                >
                  {request.contentThumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary thumbnail URL
                    <img src={request.contentThumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-300">
                      <Inbox className="h-6 w-6" />
                    </div>
                  )}
                </button>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => openReview(request)} className="truncate text-left text-sm font-bold text-black hover:underline">
                      {request.contentTitle || "Untitled"}
                    </button>
                    <span className={cn("shrink-0 border px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_STYLE[request.status])}>
                      {REQUEST_STATUS_LABELS[request.status]}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-500">
                    From <span className="font-medium text-black">{request.createdByName}</span> · {targetLabel(request)}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="border border-black bg-brand-yellow px-1.5 py-0.5 font-mono text-[10px] font-semibold text-black">
                      {REQUEST_TYPE_LABELS[request.requestType]}
                    </span>
                    <span className="flex items-center gap-1 border border-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                      <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[request.priority])} />
                      {REQUEST_PRIORITY_LABELS[request.priority]}
                    </span>
                    {dueLabel && (
                      <span
                        className={cn(
                          "border px-1.5 py-0.5 text-[10px] font-semibold",
                          dueLabel.startsWith("Overdue") ? "border-red-600 text-red-700" : "border-black/30 text-neutral-600",
                        )}
                      >
                        {dueLabel}
                      </span>
                    )}
                  </div>

                  {request.message && <p className="truncate text-xs text-neutral-600">&quot;{request.message}&quot;</p>}

                  {request.status === "pending" && (
                    <div className="mt-auto flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleAction(request, "approve")}
                        className="flex items-center gap-1 border border-black bg-brand-yellow px-2.5 py-1 text-[11px] font-bold text-black transition hover:bg-yellow-500"
                      >
                        <Check className="h-3 w-3" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAction(request, "request_changes")}
                        className="flex items-center gap-1 border border-black px-2.5 py-1 text-[11px] font-semibold text-black transition hover:bg-neutral-100"
                      >
                        <MessageSquare className="h-3 w-3" /> Request Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => openReview(request)}
                        className="ml-auto px-2.5 py-1 text-[11px] font-semibold text-neutral-600 underline underline-offset-2 hover:text-black"
                      >
                        Open Review
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};
export default RequestsPage;
