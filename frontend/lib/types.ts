/** Shared domain types for the dashboard UI. */

export interface AppUser {
  name: string;
  email: string;
  initials: string;
}

export type ContinuingItemKind = "video" | "page" | "playlist";

export interface ContinuingItem {
  id: string;
  kind: ContinuingItemKind;
  title: string;
  meta: string;
  starred?: boolean;
  /** Video only */
  durationLabel?: string;
  thumbnailGradient?: string;
  /** Video only — a real captured thumbnail, when the clip has one, shown instead of the gradient placeholder. */
  thumbnailUrl?: string;
  /** Playlist only */
  itemCount?: number;
}

export type UploadStatus = "pending" | "uploading" | "success" | "error" | "cancelled";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string;
}

export const ACCEPTED_UPLOAD_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
] as const;

export const ACCEPTED_UPLOAD_EXTENSIONS = [".mp4", ".mov", ".webm", ".pdf"] as const;

export const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
