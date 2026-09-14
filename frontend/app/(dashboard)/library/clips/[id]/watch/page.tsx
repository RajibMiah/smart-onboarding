"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListVideo } from "lucide-react";
import Link from "next/link";

import { ShareModal } from "@/components/library/ShareModal";
import { DeleteConfirmationModal } from "@/components/library/modals/DeleteConfirmationModal";
import { VideoReviewPlayer, type VideoReviewPlayerHandle } from "@/components/review/VideoReviewPlayer";
import { ClipDocumentationDeck } from "@/components/theater/ClipDocumentationDeck";
import { NextUpOverlay } from "@/components/theater/NextUpOverlay";
import { PlaybackControlDeck, type PlaybackSpeed } from "@/components/theater/PlaybackControlDeck";
import { Toast } from "@/components/ui/Toast";
import { ClipWatchHeader } from "@/components/watch/ClipWatchHeader";
import { ClipWatchSidebar } from "@/components/watch/ClipWatchSidebar";
import { useClipWatch } from "@/hooks/useClipWatch";
import { useToast } from "@/hooks/useToast";
import { clipsApi } from "@/lib/api-client";

const AUTO_ADVANCE_SECONDS = 3;

interface ClipWatchPageProps {
  params: Promise<{ id: string }>;
}

const ClipWatchPage = ({ params }: ClipWatchPageProps) => {
  const { id } = use(params);
  return <ClipWatchView clipId={id} />;
};
export default ClipWatchPage;

const ClipWatchView = ({ clipId }: { clipId: string }) => {
  const router = useRouter();
  const toast = useToast();
  const watch = useClipWatch(clipId);
  const playerRef = useRef<VideoReviewPlayerHandle>(null);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [nextUpSecondsLeft, setNextUpSecondsLeft] = useState<number | null>(null);

  const jumpBy = (delta: number) => {
    const video = playerRef.current?.getElement();
    if (video) video.currentTime = Math.max(0, video.currentTime + delta);
  };

  const applySpeed = (next: PlaybackSpeed) => {
    setSpeed(next);
    const video = playerRef.current?.getElement();
    if (video) video.playbackRate = next;
  };

  const goToClip = (id: string | null) => {
    if (id) router.push(`/library/clips/${id}/watch`);
  };

  const handleClipEnded = () => {
    if (watch.nextClipId) setNextUpSecondsLeft(AUTO_ADVANCE_SECONDS);
  };

  // Every setState below runs inside this timeout callback (asynchronous),
  // not synchronously in the effect body itself — same pattern (and the same
  // reasoning) as the identical countdown in the Playlist Theater page.
  useEffect(() => {
    if (nextUpSecondsLeft === null) return;
    const timer = setTimeout(() => {
      if (nextUpSecondsLeft <= 1) {
        setNextUpSecondsLeft(null);
        goToClip(watch.nextClipId);
      } else {
        setNextUpSecondsLeft(nextUpSecondsLeft - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `goToClip`/`watch.nextClipId` are stable enough per clip; only the countdown itself should drive this
  }, [nextUpSecondsLeft]);

  const seekPlayer = (seconds: number) => playerRef.current?.seekTo(seconds);

  const handleDownload = () => {
    const videoAsset = watch.clip?.assets.find((asset) => asset.asset_type === "video");
    if (videoAsset?.file_url) window.open(videoAsset.file_url, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.show("Link copied to clipboard.");
    } catch {
      toast.show("Couldn't copy the link.");
    }
  };

  const handleVisibilityChange = async (visibility: Parameters<typeof watch.updateVisibility>[0]) => {
    try {
      await watch.updateVisibility(visibility);
    } catch {
      toast.show("Couldn't update this clip's visibility.");
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await clipsApi.remove(clipId);
      router.push("/library/clips");
    } catch {
      toast.show("Couldn't delete this clip — please try again.");
      setIsDeleting(false);
    }
  };

  if (watch.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-xs text-neutral-500">Loading clip…</div>;
  }

  if (watch.error || !watch.clip || !watch.project) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 text-center">
        <ListVideo className="h-8 w-8 text-neutral-300" />
        <p className="text-sm font-semibold text-black">{watch.error ?? "This clip couldn't be found."}</p>
        <Link href="/library/clips" className="text-xs font-semibold text-neutral-500 underline hover:text-black">
          Back to Library
        </Link>
      </div>
    );
  }

  const videoAsset = watch.clip.assets.find((asset) => asset.asset_type === "video");

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ClipWatchHeader
        title={watch.clip.title}
        visibility={watch.clip.visibility}
        authorDepartment={watch.clip.author_department}
        authorTeam={watch.clip.author_team}
        canEdit={watch.clip.can_edit}
        isOwner={watch.clip.is_owner}
        onEditInStudio={() => router.push(`/studio?clip=${clipId}`)}
        onShare={() => setIsShareOpen(true)}
        onDownload={handleDownload}
        onCopyLink={() => void handleCopyLink()}
        onDelete={() => setIsDeleteOpen(true)}
        onVisibilityChange={(visibility) => void handleVisibilityChange(visibility)}
      />

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="relative">
            <VideoReviewPlayer ref={playerRef} project={watch.project} onEnded={handleClipEnded} autoPlayOnChange />

            {nextUpSecondsLeft !== null && watch.nextClipId && (
              <NextUpOverlay
                nextClipTitle={watch.playlistContext?.items.find((item) => item.id === watch.nextClipId)?.title ?? ""}
                secondsRemaining={nextUpSecondsLeft}
                onPlayNow={() => {
                  setNextUpSecondsLeft(null);
                  goToClip(watch.nextClipId);
                }}
                onCancel={() => setNextUpSecondsLeft(null)}
              />
            )}
          </div>

          <PlaybackControlDeck
            getElement={() => playerRef.current?.getElement() ?? null}
            volumeApplyKey={clipId}
            speed={speed}
            onSpeedChange={applySpeed}
            onJump={jumpBy}
            hasPrevious={watch.previousClipId !== null}
            hasNext={watch.nextClipId !== null}
            onPrevious={() => goToClip(watch.previousClipId)}
            onNext={() => goToClip(watch.nextClipId)}
          />

          <ClipDocumentationDeck
            clipId={clipId}
            stepGuides={watch.stepGuides}
            onSeek={seekPlayer}
            onOpenShare={() => setIsShareOpen(true)}
          />
        </div>

        <ClipWatchSidebar
          clipId={clipId}
          playlistContext={watch.playlistContext}
          relatedClips={watch.relatedClips}
          authorName={watch.clip.author_name}
          authorAvatarUrl={watch.clip.author_avatar_url}
          createdAt={watch.clip.created_at}
          durationSeconds={Number(watch.clip.duration_seconds)}
          resolution={videoAsset?.resolution ?? ""}
          fileSizeBytes={videoAsset?.file_size_bytes ?? 0}
        />
      </main>

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        contentType="clip"
        objectId={clipId}
        contentTitle={watch.clip.title}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteOpen}
        isDeleting={isDeleting}
        contentType="clip"
        title={watch.clip.title}
        playlistCount={watch.clip.playlist_count}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => void handleConfirmDelete()}
      />

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};
