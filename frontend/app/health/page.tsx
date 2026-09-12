"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  database: {
    status: string;
    vendor: string;
    name: string;
    error: string | null;
  };
};

type CheckState =
  | { phase: "loading" }
  | { phase: "success"; data: HealthResponse }
  | { phase: "error"; message: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [check, setCheck] = useState<CheckState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function fetchHealth() {
      try {
        const res = await fetch(`${API_URL}/api/health/`, { cache: "no-store" });
        const data: HealthResponse = await res.json();
        if (!cancelled) setCheck({ phase: "success", data });
      } catch (err) {
        if (!cancelled) {
          setCheck({
            phase: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    fetchHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-8 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.145] dark:bg-zinc-950">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Smart Onboarding
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Frontend &rarr; Backend &rarr; MySQL connectivity check
          </p>
        </div>

        <StatusCard check={check} />

        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Checking <code className="font-mono">{API_URL}/api/health/</code>
        </p>
      </main>
    </div>
  );
}

function StatusCard({ check }: { check: CheckState }) {
  if (check.phase === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <Spinner />
        Checking connection&hellip;
      </div>
    );
  }

  if (check.phase === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
        <p className="font-medium">Could not reach backend</p>
        <p className="mt-1 text-xs opacity-80">{check.message}</p>
      </div>
    );
  }

  const { data } = check;
  const healthy = data.status === "ok" && data.database.status === "ok";

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        healthy
          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-400"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
      }`}
    >
      <p className="font-medium">
        {healthy ? "Backend + database connected" : "Backend reachable, database degraded"}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs opacity-90">
        <dt className="font-medium">API status</dt>
        <dd>{data.status}</dd>
        <dt className="font-medium">DB status</dt>
        <dd>{data.database.status}</dd>
        <dt className="font-medium">DB vendor</dt>
        <dd>{data.database.vendor}</dd>
        <dt className="font-medium">DB name</dt>
        <dd>{data.database.name}</dd>
        {data.database.error && (
          <>
            <dt className="font-medium">Error</dt>
            <dd>{data.database.error}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-zinc-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
