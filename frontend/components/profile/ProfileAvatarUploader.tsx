"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];

interface ProfileAvatarUploaderProps {
  initials: string;
  avatarUrl: string;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
}

/** Circular avatar with a real upload — POSTs straight to /auth/me/avatar/, no client-only preview. */
export const ProfileAvatarUploader = ({ initials, avatarUrl, isUploading, onUpload }: ProfileAvatarUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please choose a JPG or PNG image.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Image must be 5MB or smaller.");
      return;
    }
    setError(null);
    try {
      await onUpload(file);
    } catch {
      setError("Couldn't upload that image — try again.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-28 w-28 items-center justify-center overflow-hidden border-2 border-black bg-black text-3xl font-bold text-white">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- backend-hosted avatar URL
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="flex items-center gap-1.5 text-sm font-semibold text-black transition hover:underline disabled:opacity-50"
      >
        <Pencil className="h-3.5 w-3.5" /> {isUploading ? "Uploading…" : "Upload"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
        aria-label="Upload profile picture"
      />

      {error && <p className="max-w-40 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
};
