"use client";

import { useEffect, useState } from "react";

import { QuickActionCards } from "@/components/dashboard/QuickActionCards";
import { ContinueEditingDeck } from "@/components/dashboard/ContinueEditingDeck";
import { ExploreSection } from "@/components/dashboard/ExploreSection";
import { StatLeaderboard } from "@/components/ui/StatLeaderboard";
import { useUI } from "@/context/ui-context";
import { useClips } from "@/hooks/useClips";
import { departmentsApi, teamsApi, type ApiDepartment, type ApiTeam } from "@/lib/api-client";
import { getTimeOfDayGreeting } from "@/lib/utils";

const DashboardPage = () => {
  const { user } = useUI();
  const { clips } = useClips();
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const firstName = user.name.split(" ")[0] || user.name;

  useEffect(() => {
    let cancelled = false;
    Promise.all([teamsApi.list(), departmentsApi.list()])
      .then(([teamPage, departmentPage]) => {
        if (cancelled) return;
        setTeams(teamPage.results);
        setDepartments(departmentPage.results);
      })
      .catch(() => {
        // Non-critical for the dashboard — the leaderboard just stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const leaderboardRows = [
    ...departments.map((department) => ({ label: department.name, kind: "Department" })),
    ...teams.map((team) => ({ label: team.name, kind: "Team" })),
  ];

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-black">
          {getTimeOfDayGreeting()}
          {firstName ? `, ${firstName}` : ""} <span aria-hidden="true">👋</span>
        </h1>
        <button
          type="button"
          className="border-2 border-black bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-100"
        >
          Customize
        </button>
      </header>

      {/* Same grid row as the header above, so this whole section's top edge lines up with "Customize". */}
      <aside className="row-span-2 lg:sticky lg:top-24">
        <StatLeaderboard
          title="Projects & Teams"
          rows={leaderboardRows.map((row, index) => ({
            rank: String(index + 1).padStart(2, "0"),
            label: row.label,
            value: row.kind,
          }))}
          summary={{ value: `${clips.length} clips`, label: "Total clips recorded across your workspace." }}
        />
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        <QuickActionCards />

        <span className="w-fit border-2 border-black bg-brand-yellow px-3 py-1 text-xs font-bold text-black">
          APC Support
        </span>

        <ContinueEditingDeck />
        <ExploreSection />
      </div>
    </div>
  );
};
export default DashboardPage;
