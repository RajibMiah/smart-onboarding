"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ExternalLink, Globe, Home, Info, UserPlus } from "lucide-react";

import { AccountInfoForm } from "@/components/profile/AccountInfoForm";
import { ProfileAvatarUploader } from "@/components/profile/ProfileAvatarUploader";
import { SettingsAccordion } from "@/components/profile/SettingsAccordion";
import { Toast } from "@/components/ui/Toast";
import { useUI } from "@/context/ui-context";
import { useToast } from "@/hooks/useToast";
import { useUserProfile } from "@/hooks/useUserProfile";
import { authApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS = [{ value: "en-US", label: "English (US)" }];

interface NotificationPref {
  id: string;
  label: string;
  description: string;
}

const NOTIFICATION_PREFS: NotificationPref[] = [
  { id: "digest", label: "Digest frequency", description: "A periodic summary of activity in your workspace." },
  { id: "requests-assigned", label: "Requests assigned to me", description: "Someone assigns you a review or approval request." },
  { id: "shared-content", label: "Shared content alerts", description: "A clip or playlist is shared with you directly." },
  { id: "system-announcements", label: "System announcements", description: "Platform updates and maintenance notices." },
];

const CAN_MANAGE_USERS_TIERS = new Set(["owner", "global_admin", "hr_manager"]);

const AccountSettingsPage = () => {
  const toast = useToast();
  const { updateApiUser, setAvatarUrl } = useUI();
  const [language, setLanguage] = useState("en-US");
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({
    digest: true,
    "requests-assigned": true,
    "shared-content": true,
    "system-announcements": false,
  });

  const { profile, isLoading, error, teams, values, setField, isDirty, isSaving, save, discard, isUploadingAvatar, uploadAvatar } =
    useUserProfile();

  const confirmAndRun = (message: string, action: () => Promise<unknown>, successMessage: string) => {
    if (!window.confirm(message)) return;
    void action().then(
      () => toast.show(successMessage),
      () => toast.show("Something went wrong — please try again."),
    );
  };

  if (isLoading || !profile) {
    return <p className="mx-auto max-w-4xl text-sm text-neutral-500">Loading your account…</p>;
  }

  const membership = profile.membership;
  const canManageUsers = membership ? CAN_MANAGE_USERS_TIERS.has(membership.role_tier) || membership.is_creator : false;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-16">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-[1fr_auto]">
        <div>
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-black">My Account</h1>
          <AccountInfoForm
            email={profile.email}
            organisation={profile.workspace?.name ?? "—"}
            roleDescription={membership?.role_description ?? ""}
            departmentName={membership?.department?.name ?? null}
            teams={teams}
            values={values}
            setField={setField}
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={() =>
              void save().then((updated) => {
                updateApiUser(updated);
                toast.show("Account details saved.");
              })
            }
            onDiscard={discard}
            onPrivacyPolicyClick={() => toast.show("The privacy policy page isn't available in this preview yet.")}
          />
        </div>

        <ProfileAvatarUploader
          initials={(profile.first_name[0] ?? profile.email[0] ?? "?").toUpperCase()}
          avatarUrl={profile.avatar_url}
          isUploading={isUploadingAvatar}
          onUpload={(file) =>
            uploadAvatar(file).then((updated) => {
              updateApiUser(updated);
              setAvatarUrl(updated.avatar_url);
            })
          }
        />
      </div>

      {error && (
        <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <SettingsAccordion
          title="Account Settings"
          description="Here you can find more settings related to your account"
          icon={Globe}
          defaultOpen
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-black" htmlFor="language-select">
                Language
              </label>
              <select
                id="language-select"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="border border-black px-3 py-1.5 text-sm text-black outline-none focus:ring-1 focus:ring-black"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Info className="h-4 w-4 text-neutral-400" aria-label="Language affects the interface only, not recording transcripts." />
            </div>

            <div className="flex flex-col gap-2 border-t border-black/10 pt-3 text-sm">
              <button
                type="button"
                onClick={() => toast.show("Changing your password isn't available in this preview yet.")}
                className="w-fit font-semibold text-black underline underline-offset-2"
              >
                Change password
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmAndRun(
                    "Log out from every device where you're signed in?",
                    () => authApi.logout({ allDevices: true }),
                    "Logged out from all devices.",
                  )
                }
                className="w-fit font-semibold text-black underline underline-offset-2"
              >
                Log out from all devices
              </button>
              <button
                type="button"
                onClick={() => toast.show("Account deletion isn't available in this preview yet.")}
                className="w-fit font-semibold text-red-600 underline underline-offset-2"
              >
                Delete account
              </button>
            </div>
          </div>
        </SettingsAccordion>

        {canManageUsers && (
          <Link
            href="/admin/users"
            className="flex items-center justify-between gap-3 border border-black px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100"
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Manage Users &amp; Invitations
            </span>
            <span className="text-xs text-neutral-400">&rarr;</span>
          </Link>
        )}

        <SettingsAccordion title="Email Notifications" icon={Bell}>
          <div className="flex flex-col gap-4">
            {NOTIFICATION_PREFS.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-black">{pref.label}</p>
                  <p className="text-xs text-neutral-500">{pref.description}</p>
                </div>
                <ToggleSwitch
                  checked={notificationPrefs[pref.id]}
                  onChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, [pref.id]: checked }))}
                  label={pref.label}
                />
              </div>
            ))}
          </div>
        </SettingsAccordion>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6 text-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => toast.show("Data protection docs aren't available in this preview yet.")}
            className="flex items-center gap-1 text-neutral-500 hover:text-black"
          >
            Data protection <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toast.show("The imprint page isn't available in this preview yet.")}
            className="flex items-center gap-1 text-neutral-500 hover:text-black"
          >
            Imprint <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toast.show("Subscription management isn't available in this preview yet.")}
            className="flex items-center gap-1.5 border border-black px-4 py-2 font-semibold text-black transition hover:bg-neutral-100"
          >
            <Bell className="h-4 w-4" /> Subscriptions
          </button>
          <Link
            href="/"
            className="flex items-center gap-1.5 border border-black px-4 py-2 font-semibold text-black transition hover:bg-neutral-100"
          >
            <Home className="h-4 w-4" /> To homepage
          </Link>
        </div>
      </div>

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};
export default AccountSettingsPage;

const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 border border-black transition", checked ? "bg-black" : "bg-white")}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 bg-white transition-transform",
          checked ? "translate-x-4 bg-brand-yellow" : "translate-x-0.5 bg-black",
        )}
      />
    </button>
  );
};
