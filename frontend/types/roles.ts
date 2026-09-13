import type { ApiSystemRoleTier, CustomRoleCapabilityFlag } from "@/lib/api-client";

export type SystemRoleTier = ApiSystemRoleTier;

export const SYSTEM_ROLE_LABELS: Record<SystemRoleTier, string> = {
  owner: "Workspace Owner",
  global_admin: "Global Administrator",
  hr_manager: "HR Manager",
  project_manager: "Project Manager",
  team_lead: "Team Lead",
  creator: "Creator",
  viewer: "Viewer",
  custom: "Custom Defined Role",
};

/** Tiers assignable from the UI — OWNER is set once at signup, not reassigned here. */
export const ASSIGNABLE_ROLE_TIERS: SystemRoleTier[] = [
  "global_admin",
  "hr_manager",
  "project_manager",
  "team_lead",
  "creator",
  "viewer",
];

export const CAPABILITY_FLAG_LABELS: Record<CustomRoleCapabilityFlag, string> = {
  can_invite_users: "Invite Users",
  can_manage_departments: "Manage Departments",
  can_manage_teams: "Manage Teams",
  can_assign_roles: "Assign Roles",
  can_publish_public_clips: "Publish Public Clips",
  can_manage_playlists: "Manage Playlists",
  can_approve_requests: "Approve Requests / Sign-offs",
  can_view_analytics: "View Analytics & Audit Logs",
  can_revoke_access: "Revoke Access",
};
