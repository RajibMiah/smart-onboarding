"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ExternalLink, Globe, Home, Info, UserPlus } from "lucide-react";

import { AccountInfoForm } from "@/components/profile/AccountInfoForm";
import { ProfileAvatarUploader } from "@/components/profile/ProfileAvatarUploader";
import { SettingsAccordion } from "@/components/profile/SettingsAccordion";
import { Toast } from "@/components/ui/Toast";
import { useUI } from "@/context/ui-context";
import { useProfileForm } from "@/hooks/useProfileForm";
import { useToast } from "@/hooks/useToast";
import { authApi } from "@/lib/api-client";

const LANGUAGE_OPTIONS = [{ value: "en-US", label: "English (US)" }];

interface NotificationPref {
  id: string;
  label: string;
  description: string;
}

const NOTIFICATION_PREFS: NotificationPref[] = [
  { id: "product-updates", label: "Product updates", description: "New features and announcements." },
  { id: "new-requests", label: "New requests", description: "Someone asks you to record a clip." },
  { id: "comments", label: "Comment notifications", description: "Comments on your clips and pages." },
  { id: "security-alerts", label: "Security alerts", description: "Sign-ins from a new device or location." },
];

const AccountSettingsPage = () => {
  const { apiUser } = useUI();
  // Keyed by user id so the form's internal state (via useProfileForm) is
  // seeded fresh once the session user finishes loading, instead of being
  // stuck with the empty initial values captured before the fetch resolved.
  return <AccountSettingsForm key={apiUser?.id ?? "loading"} />;
};
export default AccountSettingsPage;

const AccountSettingsForm = () => {
  const { user, apiUser, updateApiUser, avatarUrl, setAvatarUrl } = useUI();
  const toast = useToast();
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({
    "product-updates": true,
    "new-requests": true,
    comments: false,
    "security-alerts": true,
  });

  const form = useProfileForm({
    initialValues: {
      firstName: apiUser?.first_name ?? "",
      lastName: apiUser?.last_name ?? "",
      location: apiUser?.location || "my-location",
      department: "my-department",
      team: "my-team",
      language: apiUser?.language ?? "en-US",
    },
    onSave: async (values) => {
      const updated = await authApi.updateMe({
        first_name: values.firstName,
        last_name: values.lastName,
        location: values.location === "my-location" ? "" : values.location,
        language: values.language,
      });
      updateApiUser(updated);
      toast.show("Account details saved.");
    },
  });

  const confirmAndStub = (message: string, stubMessage: string) => {
    if (window.confirm(message)) toast.show(stubMessage);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-16">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-[1fr_auto]">
        <div>
          <h1 className="mb-6 text-xl font-semibold text-slate-900">My Account</h1>
          <AccountInfoForm
            email={user.email}
            organisation={`${user.name}'s workspace`}
            role="Creator - you can create, see and share content"
            values={form.values}
            setField={form.setField}
            isDirty={form.isDirty}
            isSaving={form.isSaving}
            onSave={form.save}
            onDiscard={form.discard}
            onPrivacyPolicyClick={() => toast.show("The privacy policy page isn't available in this preview yet.")}
          />
        </div>

        <ProfileAvatarUploader initials={user.initials} avatarUrl={avatarUrl} onAvatarChange={setAvatarUrl} />
      </div>

      <div className="flex flex-col gap-4">
        <SettingsAccordion
          title="Account Settings"
          description="Here you can find more settings related to your account"
          icon={Globe}
          defaultOpen
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="language-select">
                Language
              </label>
              <select
                id="language-select"
                value={form.values.language}
                onChange={(event) => form.setField("language", event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-apc-accent focus:ring-2 focus:ring-apc-accent/20"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Info
                className="h-4 w-4 text-slate-400"
                aria-label="Language affects the interface only, not recording transcripts."
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm">
              <button
                type="button"
                onClick={() => toast.show("Changing your password isn't available in this preview yet.")}
                className="w-fit font-medium text-slate-700 underline underline-offset-2 hover:text-apc-900"
              >
                Change password
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmAndStub(
                    "Log out from all other devices?",
                    "Logging out other devices isn't available in this preview yet.",
                  )
                }
                className="w-fit font-medium text-slate-700 underline underline-offset-2 hover:text-apc-900"
              >
                Log out from all devices
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmAndStub(
                    "Delete your APC account? This cannot be undone.",
                    "Account deletion isn't available in this preview yet.",
                  )
                }
                className="w-fit font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
              >
                Delete account
              </button>
            </div>
          </div>
        </SettingsAccordion>

        {(apiUser?.membership?.is_creator || apiUser?.membership?.is_global_admin) && (
          <Link
            href="/admin/users"
            className="flex items-center justify-between gap-3 border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Manage Users &amp; Invitations
            </span>
            <span className="text-xs text-slate-400">&rarr;</span>
          </Link>
        )}

        <SettingsAccordion title="Email Notifications" icon={Bell}>
          <div className="flex flex-col gap-4">
            {NOTIFICATION_PREFS.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">{pref.label}</p>
                  <p className="text-xs text-slate-500">{pref.description}</p>
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

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6 text-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => toast.show("Data protection docs aren't available in this preview yet.")}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
          >
            Data protection <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toast.show("The imprint page isn't available in this preview yet.")}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
          >
            Imprint <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toast.show("Subscription management isn't available in this preview yet.")}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Bell className="h-4 w-4" /> Subscriptions
          </button>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Home className="h-4 w-4" /> To homepage
          </Link>
        </div>
      </div>

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};

const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-apc-900" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
      />
    </button>
  );
};
