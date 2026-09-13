"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Link2, ListVideo, Pencil, Share2 } from "lucide-react";

import { ItemActionMenu } from "@/components/library/ItemActionMenu";
import { ShareModal } from "@/components/library/ShareModal";
import { ClipDocumentationDeck } from "@/components/theater/ClipDocumentationDeck";
import { NextUpOverlay } from "@/components/theater/NextUpOverlay";
import { PlaylistQueueSidebar } from "@/components/theater/PlaylistQueueSidebar";
import { VideoReviewPlayer, type VideoReviewPlayerHandle } from "@/components/review/VideoReviewPlayer";
import { Toast } from "@/components/ui/Toast";
import { useUI } from "@/context/ui-context";
import { usePlaylistTheater } from "@/hooks/usePlaylistTheater";
import { useToast } from "@/hooks/useToast";
import { playlistsApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;
const AUTO_ADVANCE_SECONDS = 3;

/** The roles/flags allowed to reorder a playlist that isn't theirs — mirrors
 *  the backend's `_can_manage_playlist_sequence` check in collaboration/views.py. */
const canManageSequence = (apiUser: ReturnType<typeof useUI>["apiUser"], ownerId: string | null): boolean => {
  if (!apiUser?.membership) return false;
  if (ownerId && apiUser.id === ownerId) return true;
  const { is_creator, is_global_admin, is_content_manager, role_tier } = apiUser.membership;
  return is_creator || is_global_admin || is_content_manager || role_tier === "team_lead";
};

interface TheaterPageProps {
  params: Promise<{ id: string }>;
}

const PlaylistTheaterPage = ({ params }: TheaterPageProps) => {
  const { id } = use(params);
  return <TheaterView playlistId={id} />;
};
export default PlaylistTheaterPage;

const TheaterView = ({ playlistId }: { playlistId: string }) => {
  const toast = useToast();
  const { apiUser } = useUI();
  const theater = usePlaylistTheater(playlistId);
  const playerRef = useRef<VideoReviewPlayerHandle>(null);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
  const [nextUpSecondsLeft, setNextUpSecondsLeft] = useState<number | null>(null);

  const canReorder = canManageSequence(apiUser, theater.ownerId);

  // Reset the speed selector back to 1x whenever the active clip changes — a
  // fast clip's chosen rate shouldn't silently carry over onto the next one.
  // Adjusted during render (React's documented pattern for resetting state
  // when a value changes) rather than in an effect, tracked via
  // `speedResetClipId` so it only fires on an actual clip change.
  const [speedResetClipId, setSpeedResetClipId] = useState(theater.currentClip?.id ?? null);
  if ((theater.currentClip?.id ?? null) !== speedResetClipId) {
    setSpeedResetClipId(theater.currentClip?.id ?? null);
    setSpeed(1);
  }

  useEffect(() => {
    const video = playerRef.current?.getElement();
    if (video) video.playbackRate = speed;
  }, [speed, theater.currentClip?.id]);

  useEffect(() => {
    if (nextUpSecondsLeft === null) return;
    // Every setState call below runs inside this callback, which fires
    // asynchronously after the effect body itself has finished — not
    // synchronously during the effect, which is what the lint rule flags.
    const timer = setTimeout(() => {
      if (nextUpSecondsLeft <= 1) {
        setNextUpSecondsLeft(null);
        theater.nextClip();
      } else {
        setNextUpSecondsLeft(nextUpSecondsLeft - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `theater.nextClip` is stable per clip list
  }, [nextUpSecondsLeft]);

  const handleClipEnded = () => {
    if (theater.hasNext) setNextUpSecondsLeft(AUTO_ADVANCE_SECONDS);
  };

  const seekPlayer = (seconds: number) => playerRef.current?.seekTo(seconds);
  const jumpBy = (delta: number) => {
    const video = playerRef.current?.getElement();
    if (video) video.currentTime = Math.max(0, video.currentTime + delta);
  };

  const handleRename = async () => {
    const next = window.prompt("Rename playlist", theater.playlistTitle)?.trim();
    if (!next) return;
    try {
      await playlistsApi.update(playlistId, { title: next });
      await theater.refresh();
      toast.show("Playlist renamed.");
    } catch {
      toast.show("Couldn't rename this playlist.");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.show("Link copied to clipboard.");
    } catch {
      toast.show("Couldn't copy the link.");
    }
  };

  if (theater.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-xs text-neutral-500">Loading runbook…</div>;
  }

  if (theater.error || theater.clips.length === 0) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 text-center">
        <ListVideo className="h-8 w-8 text-neutral-300" />
        <p className="text-sm font-semibold text-black">
          {theater.error ?? "This playlist doesn't have any clips yet."}
        </p>
        <Link href="/library/playlists" className="text-xs font-semibold text-neutral-500 underline hover:text-black">
          Back to Playlists
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/library/playlists"
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-black"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to Playlists
          </Link>
          <h1 className="truncate text-lg font-bold text-black">{theater.playlistTitle}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {theater.ownerDepartment && <Badge>{theater.ownerDepartment}</Badge>}
          {theater.ownerTeam && <Badge>{theater.ownerTeam}</Badge>}
          <Badge tone={theater.playlistVisibility === "private" ? "danger" : "success"}>
            {theater.playlistVisibility === "private" ? "Private" : "Public"}
          </Badge>

          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 border border-black bg-brand-yellow px-3 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-500"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share with Request
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 border border-black px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-neutral-100"
          >
            <Link2 className="h-3.5 w-3.5" />
            Copy Link
          </button>
          <ItemActionMenu
            itemLabel={theater.playlistTitle}
            items={[
              { icon: Pencil, label: "Edit Playlist Details", onClick: handleRename },
              {
                icon: ListVideo,
                label: "Reorder Clips",
                onClick: () =>
                  toast.show(
                    canReorder
                      ? "Drag a clip's ⋮⋮ handle in the sequence panel to reorder."
                      : "Only this playlist's owner, a Team Lead, or an admin can reorder it.",
                  ),
              },
              {
                icon: Download,
                label: "Export All Transcripts",
                onClick: () => toast.show("Transcript export isn't available yet."),
              },
            ]}
          />
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="relative">
            {theater.currentProject && (
              <VideoReviewPlayer ref={playerRef} project={theater.currentProject} onEnded={handleClipEnded} />
            )}

            {nextUpSecondsLeft !== null && theater.hasNext && (
              <NextUpOverlay
                nextClipTitle={theater.clips[theater.currentClipIndex + 1]?.title ?? ""}
                secondsRemaining={nextUpSecondsLeft}
                onPlayNow={() => {
                  setNextUpSecondsLeft(null);
                  theater.nextClip();
                }}
                onCancel={() => setNextUpSecondsLeft(null)}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border border-black bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => jumpBy(-5)}
                className="border border-black px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-neutral-100"
              >
                ⟲ 5s
              </button>
              <button
                type="button"
                onClick={() => jumpBy(5)}
                className="border border-black px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-neutral-100"
              >
                5s ⟳
              </button>
            </div>

            <div className="flex items-center gap-1">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Speed</span>
              {PLAYBACK_SPEEDS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSpeed(option)}
                  className={cn(
                    "border border-black px-2 py-1 text-xs font-bold transition",
                    speed === option ? "bg-brand-yellow text-black" : "text-black hover:bg-neutral-100",
                  )}
                >
                  {option}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!theater.hasPrev}
                onClick={theater.prevClip}
                className="border border-black px-3 py-1 text-xs font-semibold text-black transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                type="button"
                disabled={!theater.hasNext}
                onClick={theater.nextClip}
                className="border border-black bg-black px-3 py-1 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next Clip ➔
              </button>
            </div>
          </div>

          {theater.currentClip && theater.currentProject && (
            <ClipDocumentationDeck
              clipId={theater.currentClip.id}
              stepGuides={theater.currentStepGuides}
              project={theater.currentProject}
              onSeek={seekPlayer}
              onOpenShare={() => setIsShareOpen(true)}
            />
          )}
        </div>

        <PlaylistQueueSidebar
          clips={theater.clips}
          currentIndex={theater.currentClipIndex}
          totalDurationSeconds={theater.totalDurationSeconds}
          canReorder={canReorder}
          isReordering={theater.isReordering}
          onSelect={theater.selectClip}
          onReorder={theater.reorderClips}
        />
      </main>

      {theater.reorderError && (
        <p className="fixed bottom-4 left-4 z-30 border border-red-600 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {theater.reorderError}
        </p>
      )}

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        contentType="playlist"
        objectId={playlistId}
        contentTitle={theater.playlistTitle}
      />

      {toast.message && <Toast message={toast.message} />}
    </div>
  );
};

const Badge = ({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "danger" }) => (
  <span
    className={cn(
      "border px-2 py-0.5 font-mono text-xs",
      tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-600",
      tone === "danger" && "border-red-200 bg-red-50 text-red-600",
      tone === "default" && "border-black text-black",
    )}
  >
    {children}
  </span>
);
