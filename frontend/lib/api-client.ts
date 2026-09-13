/**
 * Thin fetch wrapper for the Django REST backend. Every request sends
 * `credentials: "include"` so the HttpOnly JWT cookies (set by
 * /auth/login/ and /auth/refresh/) ride along automatically — callers never
 * touch a token directly. A single silent refresh-and-retry handles the
 * 15-minute access-token expiry without surfacing it to the UI.
 */

const API_ROOT = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]> | null;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

const extractMessage = (body: unknown): { message: string; fieldErrors: Record<string, string[]> | null } => {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return { message: record.detail, fieldErrors: null };

    const fieldErrors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(record)) {
      if (Array.isArray(value)) fieldErrors[key] = value.map(String);
      else if (typeof value === "string") fieldErrors[key] = [value];
    }
    const firstMessage = Object.values(fieldErrors)[0]?.[0];
    if (firstMessage) return { message: firstMessage, fieldErrors };
  }
  return { message: "Something went wrong — please try again.", fieldErrors: null };
};

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_ROOT}/auth/refresh/`, { method: "POST", credentials: "include" })
    .then((response) => response.ok)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Internal: prevents infinite retry loops after a refresh attempt. */
  _retried?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, _retried = false } = options;
  const isFormData = body instanceof FormData;

  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    credentials: "include",
    // FormData bodies must NOT get an explicit Content-Type — the browser
    // sets one with the multipart boundary itself.
    headers: body !== undefined && !isFormData ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (response.status === 401 && !_retried && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, { ...options, _retried: true });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const { message, fieldErrors } = extractMessage(data);
    throw new ApiError(response.status, message, fieldErrors);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Domain types (mirrors backend/*/serializers.py output)
// ---------------------------------------------------------------------------

export interface ApiWorkspaceMembership {
  is_authorized: boolean;
  is_creator: boolean;
  is_global_admin: boolean;
  is_content_manager: boolean;
  tags: string[];
}

export interface ApiUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url: string;
  location: string;
  language: string;
  organization: string | null;
  is_active: boolean;
  membership: ApiWorkspaceMembership | null;
  created_at: string;
}

export interface ApiOrganization {
  id: string;
  name: string;
  slug: string;
  domain: string;
  logo_url: string;
  tier: string;
  created_at: string;
  updated_at: string;
}

export interface ApiTeam {
  id: string;
  organization: string;
  department: string | null;
  name: string;
  created_at: string;
}

export interface ApiDepartment {
  id: string;
  organization: string;
  name: string;
  description: string;
  created_at: string;
}

export type ClipStatus = "pending" | "processing" | "completed" | "failed";
export type ClipVisibility = "draft" | "published" | "private";

export type MediaAssetType = "video" | "audio" | "thumbnail" | "caption" | "overlay";

export interface ApiMediaAsset {
  id: string;
  /** Null for an asset still sitting in the workspace's media bin, not yet attached to a saved clip. */
  clip: string | null;
  title: string;
  asset_type: MediaAssetType;
  file_url: string;
  mime_type: string;
  file_size_bytes: number;
  resolution: string;
  width: number | null;
  height: number | null;
  duration: number;
  framerate: string | null;
  status: "uploading" | "ready" | "failed";
  created_at: string;
}

export interface ApiClip {
  id: string;
  organization: string;
  author: string;
  title: string;
  slug: string;
  description: string;
  language: string;
  duration_seconds: string;
  thumbnail_url: string;
  status: ClipStatus;
  visibility: ClipVisibility;
  assets: ApiMediaAsset[];
  created_at: string;
  updated_at: string;
}

export interface ApiPageClipItem {
  id: string;
  page: string;
  clip: string;
  step_number: number;
  step_note: string;
}

export interface ApiDocumentationPage {
  id: string;
  organization: string;
  author: string;
  title: string;
  slug: string;
  content_markdown: string;
  section_count: number;
  status: "draft" | "published";
  visibility: "public" | "private";
  clip_items: ApiPageClipItem[];
  created_at: string;
  updated_at: string;
}

export interface ApiPlaylistItem {
  id: string;
  playlist: string;
  clip: string;
  position: number;
  added_at: string;
}

export interface ApiPlaylist {
  id: string;
  organization: string;
  owner: string;
  title: string;
  description: string;
  cover_image_url: string;
  visibility: "public" | "private";
  items: ApiPlaylistItem[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface RegisterPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  organization_name: string;
}

export const authApi = {
  register: (payload: RegisterPayload) => request<ApiUser>("/auth/register/", { method: "POST", body: payload }),
  login: (payload: { email: string; password: string }) =>
    request<{ detail: string }>("/auth/login/", { method: "POST", body: payload }),
  logout: () => request<{ detail: string }>("/auth/logout/", { method: "POST" }),
  me: () => request<ApiUser>("/auth/me/"),
  updateMe: (payload: Partial<Pick<ApiUser, "first_name" | "last_name" | "avatar_url" | "location" | "language">>) =>
    request<ApiUser>("/auth/me/", { method: "PATCH", body: payload }),
};

// ---------------------------------------------------------------------------
// Org members ("Manage Users") + email-based workspace invitations
// ---------------------------------------------------------------------------

export interface ApiOrgUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  membership: ApiWorkspaceMembership | null;
  team: string | null;
  department: string | null;
  created_at: string;
}

export const usersApi = {
  list: () => request<Paginated<ApiOrgUser>>("/users/"),
};

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface ApiWorkspaceInvitation {
  id: string;
  organization: string;
  invited_by: string | null;
  email: string;
  department: string | null;
  team: string | null;
  tags: string[];
  is_authorized: boolean;
  is_creator: boolean;
  is_global_admin: boolean;
  is_content_manager: boolean;
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
}

export interface InvitationWritePayload {
  email: string;
  department?: string | null;
  team?: string | null;
  tags?: string[];
  is_authorized?: boolean;
  is_creator?: boolean;
  is_global_admin?: boolean;
  is_content_manager?: boolean;
}

export interface InvitationVerification {
  email: string;
  organization_name: string;
  is_creator: boolean;
  is_global_admin: boolean;
  is_content_manager: boolean;
}

export interface AcceptInvitationPayload {
  token: string;
  first_name?: string;
  last_name?: string;
  password: string;
}

export const invitationsApi = {
  list: () => request<Paginated<ApiWorkspaceInvitation>>("/invitations/"),
  create: (payload: InvitationWritePayload) =>
    request<ApiWorkspaceInvitation>("/invitations/", { method: "POST", body: payload }),
  revoke: (id: string) => request<void>(`/invitations/${id}/`, { method: "DELETE" }),
  verify: (token: string) => request<InvitationVerification>(`/invitations/verify/?token=${encodeURIComponent(token)}`),
  accept: (payload: AcceptInvitationPayload) =>
    request<ApiUser>("/invitations/accept/", { method: "POST", body: payload }),
};

// ---------------------------------------------------------------------------
// Clips / media assets
// ---------------------------------------------------------------------------

export interface ClipWritePayload {
  title: string;
  slug: string;
  description?: string;
  status?: ClipStatus;
  visibility?: ClipVisibility;
  duration_seconds?: number;
  thumbnail_url?: string;
}

export const clipsApi = {
  list: (params: Record<string, string> = {}) =>
    request<Paginated<ApiClip>>(`/clips/?${new URLSearchParams(params).toString()}`),
  get: (id: string) => request<ApiClip>(`/clips/${id}/`),
  create: (payload: ClipWritePayload) => request<ApiClip>("/clips/", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<ClipWritePayload>) =>
    request<ApiClip>(`/clips/${id}/`, { method: "PATCH", body: payload }),
  remove: (id: string) => request<void>(`/clips/${id}/`, { method: "DELETE" }),
  uploadThumbnail: (id: string, file: Blob, filename = "thumbnail.png") => {
    const form = new FormData();
    form.set("thumbnail", file, filename);
    return request<ApiClip>(`/clips/${id}/`, { method: "PATCH", body: form });
  },
};

// ---------------------------------------------------------------------------
// Media assets — the Studio's workspace-level media bin (video/audio/overlay
// files uploaded independently of any clip) plus per-clip output assets.
// ---------------------------------------------------------------------------

export interface MediaAssetUploadInput {
  /** Omit to upload into the workspace bin, unattached to any clip yet. */
  clip?: string;
  asset_type: MediaAssetType;
  title?: string;
  width?: number;
  height?: number;
  duration?: number;
  file: Blob;
  filename?: string;
  /** Called with 0-100 as the browser reports upload progress (requires XHR under the hood). */
  onProgress?: (percent: number) => void;
}

function uploadMediaAssetXhr(input: MediaAssetUploadInput): Promise<ApiMediaAsset> {
  const form = new FormData();
  if (input.clip) form.set("clip", input.clip);
  form.set("asset_type", input.asset_type);
  if (input.title) form.set("title", input.title);
  if (input.width !== undefined) form.set("width", String(input.width));
  if (input.height !== undefined) form.set("height", String(input.height));
  if (input.duration !== undefined) form.set("duration", String(input.duration));
  form.set("file", input.file, input.filename ?? `${input.asset_type}.webm`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_ROOT}/media-assets/`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) input.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      const data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as ApiMediaAsset);
      } else {
        const { message, fieldErrors } = extractMessage(data);
        reject(new ApiError(xhr.status, message, fieldErrors));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Upload failed — check your connection."));

    xhr.send(form);
  });
}

export const mediaAssetsApi = {
  list: (params: Record<string, string> = {}) =>
    request<Paginated<ApiMediaAsset>>(`/media-assets/?${new URLSearchParams(params).toString()}`),
  /** Real multipart upload with live progress — plain `fetch` can't report upload progress, so this uses XHR directly. */
  upload: uploadMediaAssetXhr,
  remove: (id: string) => request<void>(`/media-assets/${id}/`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Studio: timeline tracks + zoom/blur/text overlay regions
// ---------------------------------------------------------------------------

export type TrackType = "video" | "audio" | "zoom" | "blur" | "text";

export interface ApiZoomRegion {
  id: string;
  track: string;
  x: string;
  y: string;
  width: string;
  height: string;
  scale_factor: string;
  start_time: string;
  end_time: string;
}

export interface ApiBlurRegion {
  id: string;
  track: string;
  x: string;
  y: string;
  width: string;
  height: string;
  shape: "rectangle" | "ellipse";
  blur_radius: number;
  start_time: string;
  end_time: string;
}

export interface ApiTextOverlay {
  id: string;
  track: string;
  content: string;
  position_x: string;
  position_y: string;
  font_size: number;
  color: string;
  background_color: string;
  start_time: string;
  end_time: string;
}

export interface ApiTimelineTrack {
  id: string;
  clip: string;
  track_type: TrackType;
  order: number;
  zoom_regions: ApiZoomRegion[];
  blur_regions: ApiBlurRegion[];
  text_overlays: ApiTextOverlay[];
  created_at: string;
}

export const timelineTracksApi = {
  listByClip: (clipId: string) => request<Paginated<ApiTimelineTrack>>(`/timeline-tracks/?clip=${clipId}`),
  create: (payload: { clip: string; track_type: TrackType; order?: number }) =>
    request<ApiTimelineTrack>("/timeline-tracks/", { method: "POST", body: payload }),
  remove: (id: string) => request<void>(`/timeline-tracks/${id}/`, { method: "DELETE" }),
};

export const zoomRegionsApi = {
  create: (payload: Omit<ApiZoomRegion, "id">) => request<ApiZoomRegion>("/zoom-regions/", { method: "POST", body: payload }),
};

export const blurRegionsApi = {
  create: (payload: Omit<ApiBlurRegion, "id">) => request<ApiBlurRegion>("/blur-regions/", { method: "POST", body: payload }),
};

export const textOverlaysApi = {
  create: (payload: Omit<ApiTextOverlay, "id">) =>
    request<ApiTextOverlay>("/text-overlays/", { method: "POST", body: payload }),
};

// ---------------------------------------------------------------------------
// Documentation pages
// ---------------------------------------------------------------------------

export interface PageWritePayload {
  title: string;
  slug: string;
  content_markdown?: string;
  section_count?: number;
  status?: "draft" | "published";
  visibility?: "public" | "private";
}

export const pagesApi = {
  list: (params: Record<string, string> = {}) =>
    request<Paginated<ApiDocumentationPage>>(`/pages/?${new URLSearchParams(params).toString()}`),
  get: (id: string) => request<ApiDocumentationPage>(`/pages/${id}/`),
  create: (payload: PageWritePayload) => request<ApiDocumentationPage>("/pages/", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<PageWritePayload>) =>
    request<ApiDocumentationPage>(`/pages/${id}/`, { method: "PATCH", body: payload }),
  remove: (id: string) => request<void>(`/pages/${id}/`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

export interface PlaylistWritePayload {
  title: string;
  description?: string;
  cover_image_url?: string;
  visibility?: "public" | "private";
}

export const playlistsApi = {
  list: (params: Record<string, string> = {}) =>
    request<Paginated<ApiPlaylist>>(`/playlists/?${new URLSearchParams(params).toString()}`),
  get: (id: string) => request<ApiPlaylist>(`/playlists/${id}/`),
  create: (payload: PlaylistWritePayload) => request<ApiPlaylist>("/playlists/", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<PlaylistWritePayload>) =>
    request<ApiPlaylist>(`/playlists/${id}/`, { method: "PATCH", body: payload }),
  remove: (id: string) => request<void>(`/playlists/${id}/`, { method: "DELETE" }),
};

export const playlistItemsApi = {
  create: (payload: { playlist: string; clip: string; position?: number }) =>
    request<ApiPlaylistItem>("/playlist-items/", { method: "POST", body: payload }),
  remove: (id: string) => request<void>(`/playlist-items/${id}/`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Org structure (dashboard stats)
// ---------------------------------------------------------------------------

export const teamsApi = {
  list: () => request<Paginated<ApiTeam>>("/teams/"),
};

export const departmentsApi = {
  list: () => request<Paginated<ApiDepartment>>("/departments/"),
};
