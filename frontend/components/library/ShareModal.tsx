"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, X } from "lucide-react";

import { withPortal } from "@/components/hoc/withPortal";
import { departmentsApi, teamsApi, usersApi, ApiError, type ApiDepartment, type ApiOrgUser, type ApiTeam } from "@/lib/api-client";
import { useMediaRequests } from "@/hooks/useMediaRequests";
import { REQUEST_PRIORITY_LABELS, REQUEST_TYPE_LABELS, type RequestPriority, type RequestScope, type RequestType } from "@/types/sharing";
import { cn } from "@/lib/utils";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: "clip" | "playlist";
  objectId: string;
  contentTitle: string;
}

const PRIORITIES: RequestPriority[] = ["low", "medium", "high", "urgent"];
const PRIORITY_DOT: Record<RequestPriority, string> = {
  low: "bg-neutral-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-600",
};
const REQUEST_TYPES: RequestType[] = ["feedback", "approval", "update_required", "task"];

function ShareModalImpl({ isOpen, onClose, contentType, objectId, contentTitle }: ShareModalProps) {
  const { createRequest } = useMediaRequests("created_by_me");

  const [users, setUsers] = useState<ApiOrgUser[]>([]);
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);

  const [scope, setScope] = useState<RequestScope>("user");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("feedback");
  const [priority, setPriority] = useState<RequestPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    usersApi.list().then((page) => setUsers(page.results), () => undefined);
    teamsApi.list().then((page) => setTeams(page.results), () => undefined);
    departmentsApi.list().then((page) => setDepartments(page.results), () => undefined);
  }, [isOpen]);

  // Fresh form state each time the modal opens for a new share target.
  useEffect(() => {
    if (!isOpen) return;
    setScope("user");
    setSelectedUserIds([]);
    setSelectedTeamId("");
    setSelectedDepartmentId("");
    setRequestType("feedback");
    setPriority("medium");
    setDueDate("");
    setMessage("");
    setError(null);
    setSentCount(0);
  }, [isOpen, objectId]);

  const canDispatch = useMemo(() => {
    if (scope === "user") return selectedUserIds.length > 0;
    if (scope === "team") return Boolean(selectedTeamId);
    return Boolean(selectedDepartmentId);
  }, [scope, selectedUserIds, selectedTeamId, selectedDepartmentId]);

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  };

  const handleDispatch = async () => {
    if (!canDispatch) return;
    setIsSending(true);
    setError(null);
    try {
      const basePayload = {
        content_type: contentType,
        object_id: objectId,
        request_type: requestType,
        priority,
        message,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      };

      // The backend targets exactly one user/team/department per request row
      // — selecting several individual users dispatches one request each,
      // so every recipient gets their own notification and their own
      // approve/request-changes state, rather than one shared row nobody
      // can resolve independently.
      if (scope === "user") {
        await Promise.all(selectedUserIds.map((userId) => createRequest({ ...basePayload, target_user: userId })));
        setSentCount(selectedUserIds.length);
      } else if (scope === "team") {
        await createRequest({ ...basePayload, target_team: selectedTeamId });
        setSentCount(1);
      } else {
        await createRequest({ ...basePayload, target_department: selectedDepartmentId });
        setSentCount(1);
      }

      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the request — please try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-overlay-in" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col border border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-modal-in"
      >
        <div className="flex items-start justify-between gap-3 border-b border-black p-5">
          <div>
            <h2 id="share-modal-title" className="text-base font-bold text-black">
              Send with Request
            </h2>
            <p className="mt-0.5 truncate text-xs text-neutral-500">{contentTitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-black transition hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Send to</p>
          <div className="mb-3 flex border border-black">
            {(["user", "team", "department"] as RequestScope[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScope(option)}
                className={cn(
                  "flex-1 border-r border-black px-3 py-1.5 text-xs font-semibold uppercase tracking-wide last:border-r-0",
                  scope === option ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100",
                )}
              >
                {option === "user" ? "Individual User(s)" : option === "team" ? "Team" : "Department"}
              </button>
            ))}
          </div>

          {scope === "user" && (
            <div className="mb-4 max-h-32 overflow-y-auto border border-black">
              {users.length === 0 ? (
                <p className="p-3 text-xs text-neutral-400">No workspace members found.</p>
              ) : (
                users.map((user) => (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-black/10 px-3 py-1.5 text-sm last:border-b-0 hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="h-3.5 w-3.5 accent-black"
                    />
                    {user.full_name || user.email}
                  </label>
                ))
              )}
            </div>
          )}

          {scope === "team" && (
            <select
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
              aria-label="Select team"
              className="mb-4 w-full border border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="" disabled>
                Select a team
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}

          {scope === "department" && (
            <select
              value={selectedDepartmentId}
              onChange={(event) => setSelectedDepartmentId(event.target.value)}
              aria-label="Select department"
              className="mb-4 w-full border border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="" disabled>
                Select a department
              </option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          )}

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Request type</p>
          <select
            value={requestType}
            onChange={(event) => setRequestType(event.target.value as RequestType)}
            aria-label="Request type"
            className="mb-4 w-full border border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          >
            {REQUEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {REQUEST_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Priority</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {PRIORITIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPriority(option)}
                className={cn(
                  "flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold",
                  priority === option ? "border-black bg-brand-yellow text-black" : "border-black/30 text-neutral-600 hover:border-black",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[option])} />
                {REQUEST_PRIORITY_LABELS[option]}
              </button>
            ))}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Due date</p>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mb-4 border border-black px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
          />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Message</p>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder="Explain what you need from the team or reviewer (e.g., 'Please verify the step-by-step instructions for the Docker setup before Friday')."
            className="w-full resize-none border border-black p-3 text-sm focus:outline-none focus:ring-0"
          />

          {error && (
            <div role="alert" className="mt-3 border border-red-600 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {sentCount > 0 && (
            <div className="mt-3 border border-black bg-brand-yellow/20 p-2 text-xs font-semibold text-black">
              ✓ Request sent to {sentCount} recipient{sentCount === 1 ? "" : "s"}.
            </div>
          )}
        </div>

        <div className="border-t border-black p-4">
          <button
            type="button"
            onClick={() => void handleDispatch()}
            disabled={!canDispatch || isSending}
            className="flex w-full items-center justify-center gap-2 border border-black bg-brand-yellow px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isSending ? "Sending…" : "Dispatch Request & Share Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const ShareModal = withPortal(ShareModalImpl);
