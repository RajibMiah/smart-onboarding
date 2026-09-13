"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";

import { Toast } from "@/components/ui/Toast";
import { useUI } from "@/context/ui-context";
import { useToast } from "@/hooks/useToast";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { departmentsApi, teamsApi, usersApi, ApiError, type ApiOrgUser } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const CAN_MANAGE_TIERS = new Set(["owner", "global_admin", "hr_manager"]);

const RETENTION_OPTIONS: { value: string; label: string }[] = [
  { value: "indefinite", label: "Keep indefinitely" },
  { value: "365", label: "365 days" },
  { value: "90", label: "90 days" },
];

const WorkspaceSettingsPage = () => {
  const { apiUser } = useUI();
  const canManage = apiUser?.membership ? CAN_MANAGE_TIERS.has(apiUser.membership.role_tier) : false;

  const {
    workspace,
    departments,
    teams,
    isLoading,
    error,
    isSaving,
    refresh,
    updateWorkspace,
    transferOwnership,
    deleteWorkspace,
  } = useWorkspaceSettings();
  const toast = useToast();

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [members, setMembers] = useState<ApiOrgUser[]>([]);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [hasSeededForm, setHasSeededForm] = useState(false);

  // Seed the editable form fields once the real workspace loads.
  useEffect(() => {
    if (!workspace || hasSeededForm) return;
    setName(workspace.name);
    setDomain(workspace.domain);
    setLogoUrl(workspace.logo_url);
    setHasSeededForm(true);
  }, [workspace, hasSeededForm]);

  useEffect(() => {
    let cancelled = false;
    usersApi.list().then(
      (page) => {
        if (!cancelled) setMembers(page.results);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || !workspace) {
    return <p className="mx-auto max-w-4xl text-sm text-neutral-500">Loading workspace settings…</p>;
  }

  if (!canManage) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-black">Workspace</h1>
        <div className="border border-black bg-white p-4">
          <p className="text-sm font-semibold text-black">{workspace.name}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {departments.length} department{departments.length === 1 ? "" : "s"} · {teams.length} team{teams.length === 1 ? "" : "s"}
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Only the Workspace Owner, Global Administrators, or HR Managers can change workspace settings.
          </p>
        </div>
      </div>
    );
  }

  const handleSaveGeneral = () => {
    void updateWorkspace({ name, domain, logo_url: logoUrl }).then(
      () => toast.show("Workspace details saved."),
      (err: unknown) => toast.show(err instanceof ApiError ? err.message : "Couldn't save workspace details."),
    );
  };

  const handleSettingChange = (key: keyof typeof workspace.settings, value: unknown) => {
    void updateWorkspace({ settings: { ...workspace.settings, [key]: value } }).catch((err: unknown) => {
      toast.show(err instanceof ApiError ? err.message : "Couldn't save that setting.");
    });
  };

  const handleAddDepartment = () => {
    const value = window.prompt("New department name");
    if (!value?.trim()) return;
    departmentsApi.create({ name: value.trim() }).then(
      () => {
        toast.show(`"${value.trim()}" department created.`);
        void refresh();
      },
      (err: unknown) => toast.show(err instanceof ApiError ? err.message : "Couldn't create that department."),
    );
  };

  const handleAddTeam = () => {
    const value = window.prompt("New team name");
    if (!value?.trim()) return;
    teamsApi.create({ name: value.trim() }).then(
      () => {
        toast.show(`"${value.trim()}" team created.`);
        void refresh();
      },
      (err: unknown) => toast.show(err instanceof ApiError ? err.message : "Couldn't create that team."),
    );
  };

  const isOwner = workspace.owner === apiUser?.id;

  const handleTransfer = () => {
    if (!transferTargetId) return;
    if (!window.confirm("Transfer workspace ownership? You will be demoted to Global Administrator.")) return;
    void transferOwnership(transferTargetId).then(
      () => toast.show("Workspace ownership transferred."),
      (err: unknown) => toast.show(err instanceof ApiError ? err.message : "Couldn't transfer ownership."),
    );
  };

  const handleDelete = () => {
    if (deleteConfirmName !== workspace.name) {
      toast.show("Type the exact workspace name to confirm.");
      return;
    }
    if (!window.confirm("This permanently deletes the workspace and everything in it. This cannot be undone.")) return;
    void deleteWorkspace(deleteConfirmName).then(
      () => {
        toast.show("Workspace deleted.");
        window.location.href = "/login";
      },
      (err: unknown) => toast.show(err instanceof ApiError ? err.message : "Couldn't delete the workspace."),
    );
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-16">
      <h1 className="text-2xl font-bold tracking-tight text-black">Workspace</h1>

      {error && (
        <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="border border-black bg-white p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-neutral-500">General Workspace Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Workspace Name" value={name} onChange={setName} />
          <Field label="Workspace Slug / URL" value={`app.apc.local/w/${workspace.slug}`} disabled />
          <Field label="Organization Logo URL" value={logoUrl} onChange={setLogoUrl} placeholder="https://…" />
          <Field label="Primary Contact / Owner Email" value={workspace.owner_email ?? ""} disabled />
        </div>
        <button
          type="button"
          onClick={handleSaveGeneral}
          disabled={isSaving}
          className="mt-4 border border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save Details"}
        </button>
      </section>

      <section className="border border-black bg-white p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-neutral-500">Branding &amp; Theme</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-black">
          <input
            type="checkbox"
            checked={workspace.settings.force_strict_theme}
            onChange={(event) => handleSettingChange("force_strict_theme", event.target.checked)}
            className="h-4 w-4 accent-black"
          />
          Force Strict Editorial Theme (High Contrast Black Border)
        </label>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Accent color</span>
          <input
            type="color"
            value={workspace.settings.accent_color}
            onChange={(event) => handleSettingChange("accent_color", event.target.value)}
            className="h-8 w-14 cursor-pointer border border-black"
          />
          <span className="font-mono text-xs text-neutral-600">{workspace.settings.accent_color}</span>
        </div>
      </section>

      <section className="border border-black bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Department &amp; Team Structure</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddDepartment}
              className="flex items-center gap-1 border border-black px-2.5 py-1 text-xs font-semibold text-black hover:bg-neutral-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add Department
            </button>
            <button
              type="button"
              onClick={handleAddTeam}
              className="flex items-center gap-1 border border-black px-2.5 py-1 text-xs font-semibold text-black hover:bg-neutral-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add Team
            </button>
          </div>
        </div>
        <div className="overflow-x-auto border border-black">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2 text-center">Teams</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-4 text-center text-neutral-500">
                    No departments yet.
                  </td>
                </tr>
              ) : (
                departments.map((department) => (
                  <tr key={department.id} className="border-b border-black/10 last:border-0">
                    <td className="px-3 py-2 font-medium text-black">{department.name}</td>
                    <td className="px-3 py-2 text-center text-neutral-600">
                      {teams.filter((team) => team.department === department.id).length}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-black bg-white p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-neutral-500">Content &amp; Retention Policy</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Video retention period</span>
            <select
              value={workspace.settings.retention_days === null ? "indefinite" : String(workspace.settings.retention_days)}
              onChange={(event) =>
                handleSettingChange("retention_days", event.target.value === "indefinite" ? null : Number(event.target.value))
              }
              className="w-full border border-black bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-black"
            >
              {RETENTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Default visibility for new clips
            </span>
            <select
              value={workspace.settings.default_clip_visibility}
              onChange={(event) => handleSettingChange("default_clip_visibility", event.target.value)}
              className="w-full border border-black bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-black"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>
      </section>

      <section className="border border-red-600 bg-white p-5">
        <div className="mb-4 flex items-center gap-1.5 text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <h2 className="text-sm font-bold uppercase tracking-wide">Danger Zone</h2>
        </div>

        {isOwner && (
          <div className="mb-5 border-b border-black/10 pb-5">
            <p className="mb-2 text-sm font-semibold text-black">Transfer Workspace Ownership</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={transferTargetId}
                onChange={(event) => setTransferTargetId(event.target.value)}
                className="border border-black bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a member</option>
                {members
                  .filter((member) => member.id !== apiUser?.id)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={!transferTargetId}
                className="border border-black px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Transfer Ownership
              </button>
            </div>
          </div>
        )}

        {isOwner && (
          <div>
            <p className="mb-2 text-sm font-semibold text-black">Delete Workspace &amp; All Data</p>
            <p className="mb-2 text-xs text-neutral-600">
              Type <span className="font-mono font-semibold">{workspace.name}</span> to confirm.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(event) => setDeleteConfirmName(event.target.value)}
                className="border border-black px-3 py-2 text-sm"
                placeholder={workspace.name}
              />
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteConfirmName !== workspace.name}
                className={cn(
                  "border border-red-600 px-3 py-2 text-xs font-bold text-white transition",
                  deleteConfirmName === workspace.name ? "bg-red-600 hover:bg-red-700" : "cursor-not-allowed bg-red-300",
                )}
              >
                Delete Workspace
              </button>
            </div>
          </div>
        )}

        {!isOwner && <p className="text-xs text-neutral-500">Only the workspace owner can transfer ownership or delete the workspace.</p>}
      </section>

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};
export default WorkspaceSettingsPage;

const Field = ({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) => {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "w-full border border-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-black",
          disabled && "cursor-not-allowed bg-neutral-100 text-neutral-500",
        )}
      />
    </label>
  );
};
