export interface LeaderboardRow {
  rank: string;
  label: string;
  value: string;
}

interface StatLeaderboardProps {
  title: string;
  rows: LeaderboardRow[];
  summary?: {
    value: string;
    label: string;
  };
}

/** Bordered right-rail widget: a ranked table plus an optional headline stat block. */
export const StatLeaderboard = ({ title, rows, summary }: StatLeaderboardProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-2 border-black">
        <p className="border-b-2 border-black bg-neutral-100 p-2 text-sm font-bold uppercase tracking-wide text-black">
          {title}
        </p>
        <ul>
          {rows.map((row, index) => (
            <li
              key={row.rank}
              className={
                index === rows.length - 1
                  ? "flex items-center justify-between px-3 py-2 text-sm"
                  : "flex items-center justify-between border-b border-neutral-300 px-3 py-2 text-sm"
              }
            >
              <span className="font-semibold text-black">
                <span className="font-mono">{row.rank}</span> · {row.label}
              </span>
              <span className="font-bold tabular-nums text-black">{row.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {summary && (
        <div className="border-2 border-black bg-brand-yellow p-4">
          <p className="text-3xl font-black tracking-tight text-black">{summary.value}</p>
          <p className="mt-1 text-xs font-medium text-black/70">{summary.label}</p>
        </div>
      )}
    </div>
  );
};
