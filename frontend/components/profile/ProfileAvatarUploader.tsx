"use client";

import { useEffect } from "react";
import { Pencil } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";

interface ProfileAvatarUploaderProps {
  initials: string;
  /** Currently-saved avatar (shared via UIContext) — shown until a new file is picked. */
  avatarUrl: string | null;
  onAvatarChange: (url: string) => void;
}

/** Circular avatar with an upload trigger; previews the picked image instantly, client-side only. */
export const ProfileAvatarUploader = ({ initials, avatarUrl, onAvatarChange }: ProfileAvatarUploaderProps) => {
  const { previewUrl, error, fileInputRef, openFilePicker, handleFileChange } = useAvatarUpload();

  // Bubble a freshly-picked image up to the shared UIContext avatar once the
  // hook's own validation/object-URL creation has settled.
  useEffect(() => {
    if (previewUrl) onAvatarChange(previewUrl);
  }, [previewUrl, onAvatarChange]);

  const displayedUrl = previewUrl ?? avatarUrl;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-28 w-28 overflow-hidden rounded-full ring-4 ring-white shadow-popover">
        {displayedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- object-URL avatar preview
          <img src={displayedUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Avatar initials={initials} gradient="from-rose-500 to-orange-600" fill />
        )}
      </div>

      <button
        type="button"
        onClick={openFilePicker}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-apc-900"
      >
        <Pencil className="h-3.5 w-3.5" /> Upload
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Upload profile picture"
      />

      {error && <p className="max-w-40 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
};
