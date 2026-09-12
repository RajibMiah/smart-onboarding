import { QuickActionCards } from "@/components/dashboard/QuickActionCards";
import { ContinueEditingDeck } from "@/components/dashboard/ContinueEditingDeck";
import { ExploreSection } from "@/components/dashboard/ExploreSection";
import { StatLeaderboard } from "@/components/ui/StatLeaderboard";
import { TEAMS_AND_DEPARTMENTS } from "@/lib/mock-data";
import { getTimeOfDayGreeting } from "@/lib/utils";

const USER_FIRST_NAME = "Rajib";

const TOTAL_CLIPS = TEAMS_AND_DEPARTMENTS.reduce((sum, item) => sum + item.clipCount, 0);

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-black">
            {getTimeOfDayGreeting()}, {USER_FIRST_NAME}{" "}
            <span aria-hidden="true">👋</span>
          </h1>
          <button
            type="button"
            className="border-2 border-black bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-100"
          >
            Customize
          </button>
        </header>

        <QuickActionCards />

        <span className="w-fit border-2 border-black bg-brand-yellow px-3 py-1 text-xs font-bold text-black">
          APC Support
        </span>

        <ContinueEditingDeck />
        <ExploreSection />
      </div>

      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-72">
        <StatLeaderboard
          title="Projects & Teams"
          rows={TEAMS_AND_DEPARTMENTS.map((item, index) => ({
            rank: String(index + 1).padStart(2, "0"),
            label: item.name,
            value: String(item.clipCount),
          }))}
          summary={{ value: `${TOTAL_CLIPS} clips`, label: "Total clips recorded across your workspace." }}
        />
      </aside>
    </div>
  );
}
