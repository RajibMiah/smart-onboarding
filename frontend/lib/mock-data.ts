import type { ContinuingItem, ExploreChannel, TeamOrDept } from "./types";

export const CONTINUING_ITEMS: ContinuingItem[] = [
  {
    id: "video-1",
    kind: "video",
    title: "Recording on Sep 12, 2026 at 12:15 PM",
    meta: "0 views since 19 minutes",
    durationLabel: "00:10",
    thumbnailGradient: "from-slate-700 via-slate-800 to-slate-900",
  },
  {
    id: "page-1",
    kind: "page",
    title: "My first page",
    meta: "0 views • Updated 20 minutes ago",
    starred: true,
  },
  {
    id: "playlist-1",
    kind: "playlist",
    title: "My first playlist",
    meta: "Updated 20 minutes ago",
    starred: true,
    itemCount: 1,
  },
];

export const EXPLORE_CHANNELS: ExploreChannel[] = [
  {
    id: "channel-apc-tutorials",
    name: "APC Tutorials",
    subtitle: "6 new recordings",
    initials: "A",
    avatarGradient: "from-blue-600 to-blue-800",
  },
  {
    id: "channel-rajib",
    name: "Rajib R",
    subtitle: "1 new recording · 1 new page",
    initials: "R",
    avatarGradient: "from-rose-500 to-orange-600",
  },
];

export const TEAMS_AND_DEPARTMENTS: TeamOrDept[] = [
  { id: "dept-my-department", name: "My Department", type: "department", clipCount: 12 },
  { id: "team-my-team", name: "My Department: My Team", type: "team", clipCount: 8 },
];
