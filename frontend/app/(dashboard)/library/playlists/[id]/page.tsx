import { redirect } from "next/navigation";

interface PlaylistDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Every playlist click lands in the Theater now — this bare `[id]` route is
 *  kept only as a redirect target for any older link still pointing here. */
const PlaylistDetailPage = async ({ params }: PlaylistDetailPageProps) => {
  const { id } = await params;
  redirect(`/library/playlists/${id}/theater`);
};
export default PlaylistDetailPage;
