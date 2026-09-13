/** "Send with Request" sharing/feedback-request domain types. */

export type ShareContentType = "clip" | "playlist";

export type RequestType = "feedback" | "approval" | "update_required" | "task";

export type RequestPriority = "low" | "medium" | "high" | "urgent";

export type RequestStatus = "pending" | "approved" | "changes_requested" | "completed" | "canceled";

export type RequestScope = "user" | "team" | "department";

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  feedback: "Review & Feedback",
  approval: "Formal Sign-Off / Approval",
  update_required: "Edit / Update Required",
  task: "Task / Action Item",
};

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes Requested",
  completed: "Completed",
  canceled: "Canceled",
};

export interface MediaShareRequest {
  id: string;
  createdBy: string;
  createdByName: string;
  contentType: ShareContentType;
  objectId: string;
  contentTitle: string;
  contentThumbnailUrl: string;
  targetUserId: string | null;
  targetUserName: string | null;
  targetTeamId: string | null;
  targetTeamName: string | null;
  targetDepartmentId: string | null;
  targetDepartmentName: string | null;
  requestType: RequestType;
  priority: RequestPriority;
  status: RequestStatus;
  message: string;
  dueDate: string | null;
  resolutionNote: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
