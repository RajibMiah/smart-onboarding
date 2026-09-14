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

export type ApiSystemRoleTier =
  | "owner"
  | "global_admin"
  | "hr_manager"
  | "project_manager"
  | "team_lead"
  | "creator"
  | "viewer"
  | "custom";

export interface ApiRoleRef {
  id: string;
  name: string;
}

export interface ApiWorkspaceMembership {
  is_authorized: boolean;
  is_creator: boolean;
  is_global_admin: boolean;
  is_content_manager: boolean;
  tags: string[];
  role_tier: ApiSystemRoleTier;
  role_display: string;
  role_description: string;
  custom_role: string | null;
  custom_role_name: string | null;
  department: ApiRoleRef | null;
  team: ApiRoleRef | null;
  revoked_at: string | null;
}

export interface ApiUserWorkspace {
  id: string;
  name: string;
  slug: string;
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
  workspace: ApiUserWorkspace | null;
  is_active: boolean;
  membership: ApiWorkspaceMembership | null;
  created_at: string;
}

export interface ApiWorkspaceSettings {
  retention_days: number | null;
  default_clip_visibility: "draft" | "published";
  force_strict_theme: boolean;
  accent_color: string;
}

export interface ApiOrganization {
  id: string;
  name: string;
  slug: string;
  domain: string;
  logo_url: string;
  tier: string;
  owner: string | null;
  owner_email: string | null;
  settings: ApiWorkspaceSettings;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceUpdatePayload {
  name?: string;
  domain?: string;
  logo_url?: string;
  settings?: Partial<ApiWorkspaceSettings>;
}

export const organizationsApi = {
  current: () => request<Paginated<ApiOrganization>>("/organizations/").then((page) => page.results[0] ?? null),
  update: (id: string, payload: WorkspaceUpdatePayload) =>
    request<ApiOrganization>(`/organizations/${id}/`, { method: "PATCH", body: payload }),
  transferOwnership: (id: string, newOwnerId: string) =>
    request<ApiOrganization>(`/organizations/${id}/transfer-ownership/`, {
      method: "POST",
      body: { new_owner_id: newOwnerId },
    }),
  remove: (id: string, confirmName: string) =>
    request<void>(`/organizations/${id}/`, { method: "DELETE", body: { confirm_name: confirmName } }),
};

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
  filter_settings: {
    brightness: number;
    contrast: number;
    saturation: number;
    volumeGain: number;
    noiseSuppression: boolean;
  };
  assets: ApiMediaAsset[];
  /** May edit this clip's content (cuts, filters, metadata) — its own
   *  creator, a global admin, or a delegated `can_edit` share. Does *not*
   *  by itself permit changing visibility or deleting — see `is_owner`. */
  can_edit: boolean;
  /** This clip's own creator or a global admin — no delegated share
   *  satisfies this, however broad. Gates changing visibility and deleting. */
  is_owner: boolean;
  /** How many distinct playlists this clip is currently in — surfaced by the
   *  delete confirmation modal ("present in N playlists, will be unlinked"). */
  playlist_count: number;
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
  /** May edit this playlist's content/structure — not by itself changing
   *  visibility or deleting it, see `is_owner`. */
  can_edit: boolean;
  /** This playlist's own owner or a global admin. Gates changing visibility and deleting. */
  is_owner: boolean;
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
  logout: (options?: { allDevices?: boolean }) =>
    request<{ detail: string }>("/auth/logout/", { method: "POST", body: { all_devices: Boolean(options?.allDevices) } }),
  me: () => request<ApiUser>("/auth/me/"),
  updateMe: (
    payload: Partial<Pick<ApiUser, "first_name" | "last_name" | "location" | "language">> & { team_id?: string | null },
  ) => request<ApiUser>("/auth/me/", { method: "PATCH", body: payload }),
  uploadAvatar: (file: Blob) => {
    const form = new FormData();
    form.set("avatar", file, "avatar.jpg");
    return request<ApiUser>("/auth/me/avatar/", { method: "POST", body: form });
  },
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

export interface MemberRoleUpdatePayload {
  role_tier?: ApiSystemRoleTier;
  custom_role?: string | null;
}

export const usersApi = {
  list: () => request<Paginated<ApiOrgUser>>("/users/"),
  updateRole: (id: string, payload: MemberRoleUpdatePayload) =>
    request<ApiOrgUser>(`/users/${id}/role/`, { method: "PATCH", body: payload }),
  revoke: (id: string) => request<ApiOrgUser>(`/users/${id}/revoke/`, { method: "POST" }),
  reactivate: (id: string) => request<ApiOrgUser>(`/users/${id}/reactivate/`, { method: "POST" }),
};

export const CUSTOM_ROLE_CAPABILITY_FLAGS = [
  "can_invite_users",
  "can_manage_departments",
  "can_manage_teams",
  "can_assign_roles",
  "can_publish_public_clips",
  "can_manage_playlists",
  "can_approve_requests",
  "can_view_analytics",
  "can_revoke_access",
] as const;

export type CustomRoleCapabilityFlag = (typeof CUSTOM_ROLE_CAPABILITY_FLAGS)[number];

export type ApiCustomRole = {
  id: string;
  organization: string;
  name: string;
  description: string;
  created_by: string | null;
  department: string | null;
  department_name: string | null;
  created_at: string;
} & Record<CustomRoleCapabilityFlag, boolean>;

export type CustomRolePayload = {
  name: string;
  description?: string;
  department?: string | null;
} & Partial<Record<CustomRoleCapabilityFlag, boolean>>;

export const customRolesApi = {
  list: () => request<Paginated<ApiCustomRole>>("/custom-roles/"),
  create: (payload: CustomRolePayload) => request<ApiCustomRole>("/custom-roles/", { method: "POST", body: payload }),
  remove: (id: string) => request<void>(`/custom-roles/${id}/`, { method: "DELETE" }),
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
  filter_settings?: {
    brightness: number;
    contrast: number;
    saturation: number;
    volumeGain: number;
    noiseSuppression: boolean;
  };
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
  watch: (id: string) => request<ApiClipWatch>(`/clips/${id}/watch/`),
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

export type TrackType = "video" | "audio" | "zoom" | "blur" | "text" | "cut";

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

export interface ApiCut {
  id: string;
  track: string;
  cut_type: "keep" | "silence_speedup" | "cut";
  speed_multiplier: string | null;
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
  cuts: ApiCut[];
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

export const cutsApi = {
  create: (payload: Omit<ApiCut, "id">) => request<ApiCut>("/cuts/", { method: "POST", body: payload }),
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

export interface ApiStepGuide {
  id: string;
  clip: string;
  step_number: number;
  timestamp_seconds: string;
  title: string;
  description_markdown: string;
  snapshot_image_url: string;
  created_at: string;
}

/** A clip as it plays inside the Playlist Theater — `ApiClip` plus its full
 *  non-destructive edit tracks and step guides, all in one nested payload. */
export interface ApiTheaterClip extends ApiClip {
  tracks: ApiTimelineTrack[];
  step_guides: ApiStepGuide[];
  author_name: string;
  author_avatar_url: string;
  author_department: string | null;
  author_team: string | null;
}

export interface ApiWatchPlaylistItem {
  id: string;
  title: string;
  duration_seconds: string;
  position: number;
}

export interface ApiWatchPlaylistContext {
  id: string;
  title: string;
  items: ApiWatchPlaylistItem[];
}

export interface ApiRelatedClip {
  id: string;
  title: string;
  duration_seconds: string;
}

/** Single-clip counterpart to `ApiPlaylistTheater` — everything the Clip
 *  Watch page needs in one payload, including enough playlist context to
 *  decide between the "sibling queue" and "standalone clip" sidebar. */
export interface ApiClipWatch extends ApiTheaterClip {
  playlist_context: ApiWatchPlaylistContext | null;
  related_clips: ApiRelatedClip[];
}

export interface ApiPlaylistTheaterItem {
  id: string;
  clip: ApiTheaterClip;
  position: number;
}

export interface ApiPlaylistTheater {
  id: string;
  organization: string;
  owner: string;
  owner_name: string;
  /** Derived from whichever team the playlist's owner belongs to — the
   *  Playlist model itself has no department/team of its own. */
  owner_department: string | null;
  owner_team: string | null;
  title: string;
  description: string;
  visibility: "public" | "private";
  items: ApiPlaylistTheaterItem[];
  /** May edit/reorder this playlist's content — not by itself changing
   *  visibility or deleting it, see `is_owner`. */
  can_edit: boolean;
  /** This playlist's own owner or a global admin. Gates changing visibility and deleting. */
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

export const playlistsApi = {
  list: (params: Record<string, string> = {}) =>
    request<Paginated<ApiPlaylist>>(`/playlists/?${new URLSearchParams(params).toString()}`),
  get: (id: string) => request<ApiPlaylist>(`/playlists/${id}/`),
  create: (payload: PlaylistWritePayload) => request<ApiPlaylist>("/playlists/", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<PlaylistWritePayload>) =>
    request<ApiPlaylist>(`/playlists/${id}/`, { method: "PATCH", body: payload }),
  remove: (id: string) => request<void>(`/playlists/${id}/`, { method: "DELETE" }),
  theater: (id: string) => request<ApiPlaylistTheater>(`/playlists/${id}/theater/`),
  reorder: (id: string, orderedClipIds: string[]) =>
    request<ApiPlaylistTheater>(`/playlists/${id}/reorder/`, {
      method: "PUT",
      body: { ordered_clip_ids: orderedClipIds },
    }),
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
  create: (payload: { name: string; department?: string | null }) =>
    request<ApiTeam>("/teams/", { method: "POST", body: payload }),
};

export const departmentsApi = {
  list: () => request<Paginated<ApiDepartment>>("/departments/"),
  create: (payload: { name: string; description?: string }) =>
    request<ApiDepartment>("/departments/", { method: "POST", body: payload }),
};

// ---------------------------------------------------------------------------
// Send-with-Request sharing/feedback-request inbox
// ---------------------------------------------------------------------------

export type ApiRequestContentType = "clip" | "playlist";
export type ApiRequestType = "feedback" | "approval" | "update_required" | "task";
export type ApiRequestPriority = "low" | "medium" | "high" | "urgent";
export type ApiRequestStatus = "pending" | "approved" | "changes_requested" | "completed" | "canceled";
export type ApiRequestAction = "approve" | "request_changes" | "complete";

export interface ApiMediaShareRequest {
  id: string;
  organization: string;
  created_by: string;
  created_by_name: string;
  content_type: ApiRequestContentType;
  object_id: string;
  content_title: string;
  content_thumbnail_url: string;
  target_user: string | null;
  target_user_name: string | null;
  target_team: string | null;
  target_team_name: string | null;
  target_department: string | null;
  target_department_name: string | null;
  request_type: ApiRequestType;
  priority: ApiRequestPriority;
  status: ApiRequestStatus;
  message: string;
  due_date: string | null;
  resolution_note: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaShareRequestPayload {
  content_type: ApiRequestContentType;
  object_id: string;
  target_user?: string | null;
  target_team?: string | null;
  target_department?: string | null;
  request_type: ApiRequestType;
  priority: ApiRequestPriority;
  message: string;
  due_date?: string | null;
}

export const shareRequestsApi = {
  list: (params: Record<string, string> = {}) =>
    request<Paginated<ApiMediaShareRequest>>(`/requests/?${new URLSearchParams(params).toString()}`),
  create: (payload: MediaShareRequestPayload) =>
    request<ApiMediaShareRequest>("/requests/", { method: "POST", body: payload }),
  remove: (id: string) => request<void>(`/requests/${id}/`, { method: "DELETE" }),
  resolve: (id: string, action: ApiRequestAction, note = "") =>
    request<ApiMediaShareRequest>(`/requests/${id}/action/`, { method: "POST", body: { action, note } }),
};

export type ApiSharePermission = "view" | "comment" | "edit";

export interface ApiSharedContent {
  id: string;
  organization: string;
  shared_by: string;
  shared_by_name: string;
  shared_by_avatar_url: string;
  content_type: ApiRequestContentType;
  object_id: string;
  content_title: string;
  content_thumbnail_url: string;
  target_user: string | null;
  target_user_name: string | null;
  target_team: string | null;
  target_team_name: string | null;
  target_department: string | null;
  target_department_name: string | null;
  permission: ApiSharePermission;
  can_view: boolean;
  can_edit: boolean;
  can_reorder: boolean;
  can_reshare: boolean;
  parent_share: string | null;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_by_name?: string;
  /** Whether the current user may edit this row's flags or revoke it —
   *  its issuer, the root content's owner, an admin, or a delegate holding
   *  `can_reshare` on the underlying content. */
  can_manage: boolean;
  created_at: string;
}

export interface SharedContentPayload {
  content_type: ApiRequestContentType;
  object_id: string;
  target_user?: string | null;
  target_team?: string | null;
  target_department?: string | null;
  permission: ApiSharePermission;
}

export interface ShareCapabilityUpdate {
  can_view?: boolean;
  can_edit?: boolean;
  can_reorder?: boolean;
  can_reshare?: boolean;
}

export interface ShareDashboardQuery {
  scope?: "shared_by_me" | "shared_with_me";
  status?: "active" | "revoked";
  resource_type?: "clip" | "playlist";
  target_type?: "user" | "team" | "department";
  search?: string;
}

export const sharedContentApi = {
  list: (params: Record<string, string> = {}) =>
    request<Paginated<ApiSharedContent>>(`/shared-content/?${new URLSearchParams(params).toString()}`),
  create: (payload: SharedContentPayload) =>
    request<ApiSharedContent>("/shared-content/", { method: "POST", body: payload }),
  updateCapabilities: (id: string, payload: ShareCapabilityUpdate) =>
    request<ApiSharedContent>(`/shared-content/${id}/`, { method: "PATCH", body: payload }),
  revoke: (id: string) => request<ApiSharedContent>(`/shared-content/${id}/revoke/`, { method: "POST" }),
  dashboard: (query: ShareDashboardQuery = {}) => {
    const params = new URLSearchParams(query as Record<string, string>);
    return request<ApiSharedContent[]>(`/shared-content/dashboard/?${params.toString()}`);
  },
};

export interface ApiSharedFeedItem {
  id: string;
  kind: "share" | "request";
  content_type: ApiRequestContentType;
  object_id: string;
  content_title: string;
  content_thumbnail_url: string;
  actor_name: string;
  actor_avatar_url: string;
  target_label: string;
  permission: ApiSharePermission | null;
  request_type: ApiRequestType | null;
  status: ApiRequestStatus | null;
  created_at: string;
}

export const sharedFeedApi = {
  list: (scope: "with_me" | "by_me") =>
    request<{ count: number; results: ApiSharedFeedItem[] }>(`/sharing/feed/?scope=${scope}`),
};

export type ApiNotificationType = "content_shared" | "request_created" | "request_resolved";

export interface ApiNotification {
  id: string;
  sender: string | null;
  sender_name: string | null;
  sender_avatar_url: string | null;
  notification_type: ApiNotificationType;
  title: string;
  message: string;
  action_url: string;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  list: (params: Record<string, string> = {}) =>
    request<Paginated<ApiNotification>>(`/notifications/?${new URLSearchParams(params).toString()}`),
  markRead: (id: string) => request<ApiNotification>(`/notifications/${id}/read/`, { method: "PATCH" }),
  markAllRead: () => request<{ updated: number }>("/notifications/mark-all-read/", { method: "POST" }),
};
