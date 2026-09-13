"use client";

import { useEffect, useState } from "react";
import { Users2 } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { teamsApi, type ApiTeam } from "@/lib/api-client";

const AVATAR_GRADIENT = "from-blue-600 to-blue-800";

export const ExploreSection = () => {
  const [teams, setTeams] = useState<ApiTeam[]>([]);

  useEffect(() => {
    let cancelled = false;
    teamsApi
      .list()
      .then((page) => {
        if (!cancelled) setTeams(page.results);
      })
      .catch(() => {
        // Non-critical for the dashboard — leave the section empty on failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (teams.length === 0) return null;

  return (
    <section aria-labelledby="explore-heading">
      <h2 id="explore-heading" className="mb-3 flex items-center gap-2 text-base font-bold text-black">
        <Users2 className="h-[18px] w-[18px]" aria-hidden="true" />
        Explore new content
      </h2>
      <div className="flex flex-wrap gap-6">
        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            className="flex w-28 flex-col items-center gap-2 p-2 text-center transition hover:bg-neutral-100"
          >
            <Avatar initials={team.name[0]?.toUpperCase() ?? "?"} gradient={AVATAR_GRADIENT} size="lg" />
            <span className="text-sm font-semibold text-black">{team.name}</span>
            <span className="text-xs text-neutral-600">Team</span>
          </button>
        ))}
      </div>
    </section>
  );
};
