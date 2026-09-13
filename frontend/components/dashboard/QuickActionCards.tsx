"use client";

import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Camera, ScanLine, Upload, UploadCloud } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { useModal } from "@/hooks/useModal";
import { UPLOAD_MODAL_ID } from "@/components/modals/UploadModal";

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  onSelect?: () => void;
}

const useQuickActions = (): QuickAction[] => {
  const router = useRouter();
  const uploadModal = useModal(UPLOAD_MODAL_ID);

  return [
    {
      id: "screen-recording",
      title: "Screen Recording",
      subtitle: "Capture processes on screen",
      icon: ScanLine,
      onSelect: () => router.push("/studio"),
    },
    {
      id: "camera-capture",
      title: "Camera capture",
      subtitle: "Create content using your camera",
      icon: Camera,
      onSelect: () => router.push("/studio"),
    },
    {
      id: "upload-files",
      title: "Upload files",
      subtitle: "Add videos & images from your device",
      icon: Upload,
      onSelect: uploadModal.open,
    },
    {
      id: "upload-slide-deck",
      title: "Upload Slide Deck",
      subtitle: "Turn PDF documents into a recording",
      icon: UploadCloud,
      onSelect: () => router.push("/studio"),
    },
  ];
};

export const QuickActionCards = () => {
  const actions = useQuickActions();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map(({ id, title, subtitle, icon: Icon, onSelect }) => (
        <Card
          key={id}
          className="group cursor-pointer transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard"
        >
          <button
            type="button"
            onClick={onSelect}
            className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-white text-black transition group-hover:bg-black group-hover:text-white">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-black">{title}</span>
              <span className="mt-0.5 block text-sm text-neutral-600">{subtitle}</span>
            </span>
          </button>
        </Card>
      ))}
    </div>
  );
};
