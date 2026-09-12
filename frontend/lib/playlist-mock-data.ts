import type { Playlist, PlaylistVisibility } from "@/types/playlist";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

const SEED_PLAYLISTS: Playlist[] = [
  {
    id: "onboarding-2026",
    title: "Onboarding 2026",
    description: "Everything a new hire needs to get started.",
    clipCount: 0,
    thumbnailUrl: null,
    visibility: "public",
    createdAt: hoursAgo(400),
    updatedAt: hoursAgo(5),
    clipIds: [],
  },
  {
    id: "product-tutorials",
    title: "Product Tutorials",
    description: "Feature walkthroughs for customers.",
    clipCount: 0,
    thumbnailUrl: null,
    visibility: "public",
    createdAt: hoursAgo(300),
    updatedAt: hoursAgo(7),
    clipIds: [],
  },
  {
    id: "engineering-guides",
    title: "Engineering Guides",
    description: "Internal engineering runbooks and setup guides.",
    clipCount: 0,
    thumbnailUrl: null,
    visibility: "private",
    createdAt: hoursAgo(200),
    updatedAt: hoursAgo(30),
    clipIds: [],
  },
];

/** Same plain-external-store pattern as `library-mock-data.ts`'s clips store — see that file for why. */
let playlistsStore: Playlist[] = [...SEED_PLAYLISTS];
const playlistsListeners = new Set<() => void>();

function notifyPlaylistsListeners(): void {
  playlistsListeners.forEach((listener) => listener());
}

export function subscribeToPlaylists(listener: () => void): () => void {
  playlistsListeners.add(listener);
  return () => playlistsListeners.delete(listener);
}

export function getPlaylistsSnapshot(): Playlist[] {
  return playlistsStore;
}

export function addPlaylist(input: { title: string; description?: string; visibility: PlaylistVisibility }): Playlist {
  const now = new Date().toISOString();
  const playlist: Playlist = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    clipCount: 0,
    thumbnailUrl: null,
    visibility: input.visibility,
    createdAt: now,
    updatedAt: now,
    clipIds: [],
  };
  playlistsStore = [playlist, ...playlistsStore];
  notifyPlaylistsListeners();
  return playlist;
}

/** Links a saved clip into a playlist — how the Review page's playlist assignment becomes real. */
export function addClipToPlaylist(playlistId: string, clipId: string): void {
  playlistsStore = playlistsStore.map((playlist) => {
    if (playlist.id !== playlistId || playlist.clipIds.includes(clipId)) return playlist;
    const clipIds = [...playlist.clipIds, clipId];
    return { ...playlist, clipIds, clipCount: clipIds.length, updatedAt: new Date().toISOString() };
  });
  notifyPlaylistsListeners();
}

export function renamePlaylist(id: string, title: string): void {
  playlistsStore = playlistsStore.map((playlist) =>
    playlist.id === id ? { ...playlist, title, updatedAt: new Date().toISOString() } : playlist,
  );
  notifyPlaylistsListeners();
}

export function setPlaylistVisibility(id: string, visibility: PlaylistVisibility): void {
  playlistsStore = playlistsStore.map((playlist) =>
    playlist.id === id ? { ...playlist, visibility, updatedAt: new Date().toISOString() } : playlist,
  );
  notifyPlaylistsListeners();
}

export function duplicatePlaylist(id: string): void {
  const source = playlistsStore.find((playlist) => playlist.id === id);
  if (!source) return;
  const now = new Date().toISOString();
  const copy: Playlist = { ...source, id: crypto.randomUUID(), title: `${source.title} (copy)`, createdAt: now, updatedAt: now };
  playlistsStore = [copy, ...playlistsStore];
  notifyPlaylistsListeners();
}

export function removePlaylist(id: string): void {
  playlistsStore = playlistsStore.filter((playlist) => playlist.id !== id);
  notifyPlaylistsListeners();
}
