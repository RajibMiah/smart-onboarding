import { Users2 } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { EXPLORE_CHANNELS } from "@/lib/mock-data";

export function ExploreSection() {
  return (
    <section aria-labelledby="explore-heading">
      <h2 id="explore-heading" className="mb-3 flex items-center gap-2 text-base font-bold text-black">
        <Users2 className="h-[18px] w-[18px]" aria-hidden="true" />
        Explore new content
      </h2>
      <div className="flex flex-wrap gap-6">
        {EXPLORE_CHANNELS.map((channel) => (
          <button
            key={channel.id}
            type="button"
            className="flex w-28 flex-col items-center gap-2 p-2 text-center transition hover:bg-neutral-100"
          >
            <Avatar initials={channel.initials} gradient={channel.avatarGradient} size="lg" />
            <span className="text-sm font-semibold text-black">{channel.name}</span>
            <span className="text-xs text-neutral-600">{channel.subtitle}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
