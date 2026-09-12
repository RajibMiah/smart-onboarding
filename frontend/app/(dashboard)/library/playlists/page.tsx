import { ListVideo } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/ComingSoon";

export default function PlaylistsLibraryPage() {
  return (
    <ComingSoon
      icon={ListVideo}
      title="Playlists"
      description="Group clips into playlists your team can watch in order."
    />
  );
}
